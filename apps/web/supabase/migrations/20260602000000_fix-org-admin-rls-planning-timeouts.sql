/*
 * -------------------------------------------------------
 * Migration: Fix org-admin RLS planning timeouts (production incident)
 *
 * Incident summary
 * ----------------
 * The `authenticated` role has statement_timeout = 8 s. Queries that touch
 * public.cards, public.organization_profiles, or public.accounts now spend
 * 9–38 s in PLANNING before execution even starts (execution is <100 ms),
 * causing SQLSTATE 57014 cancellations and 500 errors on:
 *   - org-admin dashboard (RPCs)
 *   - distributors page   (direct PostgREST query against public.cards)
 *   - cards page          (direct PostgREST query against public.cards)
 *
 * Root cause
 * ----------
 * When the planner plans a query against an RLS-protected table it expands
 * every permissive policy on that table. Policies that reference SECURITY
 * INVOKER helpers (or inline subqueries) over OTHER RLS tables cause the
 * planner to recurse into those tables' policies too. public.accounts now has
 * 7 permissive SELECT policies whose helper chain re-references cards /
 * accounts_memberships, so any path that reaches public.accounts during
 * planning explodes combinatorially. Measured planning times on prod (exec was
 * always <100 ms): cards reads 9.3 s, organization_profiles reads 29 s,
 * org-admin analytics RPCs 37 s — all over the 8 s authenticated
 * statement_timeout → SQLSTATE 57014 → 500.
 *
 * Bisection on prod pinned the exact drivers:
 *   - cards / distributors pages: cards_cardholder_read and
 *     cards_distributor_read call get_user_personal_account_id() (SECURITY
 *     INVOKER) whose body scans public.accounts; the planner evaluates it by
 *     planning that scan with the full 7-policy accounts expansion.
 *   - distributors page: organization_profiles_cardholder_read embeds an
 *     inline subquery over public.cards.
 *   - org-admin dashboard: every get_org_admin_* RPC is SECURITY INVOKER and
 *     joins cards / organization_profiles / accounts.
 * (Migration 20260523084620 adding is_cardholder_in_my_orgs() to accounts is
 * the change that tipped this past the 8 s ceiling.)
 *
 * Fix strategy
 * ------------
 * LAYER A — org-admin analytics RPCs (restores the dashboard)
 *   Convert all get_org_admin_* analytics RPCs from SECURITY INVOKER to
 *   SECURITY DEFINER so the executor bypasses RLS inside the body — planning
 *   collapses to microseconds (verified: 37 s → 0.02 ms). A mandatory
 *   authorization guard at the top of each function reproduces the access
 *   check RLS would otherwise enforce (caller must be org_admin of
 *   org_account_id).
 *
 * LAYER B — direct page queries (restores distributors & cards pages)
 *   B1. Make get_user_personal_account_id() SECURITY DEFINER so the planner no
 *       longer expands public.accounts when planning the cards policies that
 *       call it (verified: cards read 9.3 s → 13 ms). The helper is hard-scoped
 *       to the caller's own account, so DEFINER is safe. (plpgsql conversion
 *       alone was tested and did NOT help — DEFINER is the operative change.)
 *   B4. Replace organization_profiles_cardholder_read's inline subquery over
 *       public.cards with a SECURITY DEFINER helper, cutting the cards-RLS
 *       expansion chain (verified: organization_profiles read 29 s → 12 ms).
 *   B5. Replace cards_merchant_validate_read's inline subquery over
 *       accounts_memberships with a SECURITY DEFINER helper (defense-in-depth:
 *       removes another expansion source from the cards policy set).
 *
 * Security equivalence
 * --------------------
 * See per-object comments below.
 *
 * Idempotency
 * -----------
 * All function replacements use CREATE OR REPLACE. Policy changes use
 * DROP POLICY IF EXISTS before CREATE POLICY.
 *
 * DO NOT apply to any database without review.
 * -------------------------------------------------------
 */

-- ===========================================================================
-- LAYER B — Stop RLS planning-time explosion on direct cards/org_profiles reads
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- B1. get_user_personal_account_id()  →  SECURITY DEFINER
--
-- This helper is called from inside the RLS policies cards_cardholder_read
-- (cardholder_id = get_user_personal_account_id()), cards_distributor_read
-- (distributor_id = get_user_personal_account_id()), and the new
-- org_profile_readable_by_cardholder() below.
--
-- Problem: as SECURITY INVOKER, when the planner expands those policies it
-- evaluates the helper by planning its inner `select ... from public.accounts`
-- under the caller's RLS context, which expands public.accounts' 7 permissive
-- policies (each calling further RLS-table-querying helpers) — a combinatorial
-- planning-time explosion. Measured on prod: a trivial
-- `select count(*) from public.cards where organization_id = $1` took ~9.3 s
-- to PLAN (execution <20 ms), exceeding the 8 s statement_timeout → SQLSTATE
-- 57014 → 500 on the cards & distributors pages. Bisection confirmed
-- cards_cardholder_read + cards_distributor_read are the drivers; converting
-- this helper to plpgsql alone did NOT help (the planner still evaluates the
-- STABLE invoker function by planning its accounts subquery with full RLS
-- expansion).
--
-- Fix: SECURITY DEFINER. The body then runs with RLS bypassed, so the planner
-- does not expand public.accounts when planning any policy that calls it.
-- Verified on prod: the same cards query then plans in ~13 ms.
--
-- Security: the function takes no arguments and is hard-scoped to
-- `primary_owner_user_id = auth.uid()`, so it can only ever return the
-- CALLER's own personal-account id. SECURITY DEFINER introduces no privilege
-- escalation or cross-user disclosure — the return value is identical to the
-- SECURITY INVOKER version (a user can always read their own account row under
-- accounts_read anyway). plpgsql is retained so the body is also opaque to
-- inlining.
-- ---------------------------------------------------------------------------

create or replace function public.get_user_personal_account_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (
    select id from public.accounts
    where primary_owner_user_id = auth.uid()
      and is_personal_account = true
    limit 1
  );
end;
$$;

grant execute on function public.get_user_personal_account_id() to authenticated;

-- NOTE: is_account_team_member() and get_user_platform_role() were considered
-- for the same treatment but measured as NON-drivers — they are not called
-- from the hot-path cards / organization_profiles policies, and as top-level
-- RPCs they plan in <0.05 ms. They are intentionally left unchanged to keep
-- the blast radius off shared Makerkit helpers.

-- ---------------------------------------------------------------------------
-- B4. organization_profiles_cardholder_read policy
--
-- Before: inline EXISTS subquery directly over public.cards (an RLS table)
--   → planning any query on organization_profiles expands cards' policies,
--     then recursively expands accounts' policies through cards' policies.
--
-- Fix: introduce a SECURITY DEFINER helper (opaque to the planner) that
-- executes the same subquery with RLS bypassed, then rewrite the policy to
-- call only that helper.
--
-- New helper: org_profile_readable_by_cardholder(uuid)
--   Checks if the current user has an activated card belonging to the
--   given org account. SECURITY DEFINER bypasses RLS on cards (safe: the
--   WHERE clause gates results to the caller's own cardholder_id via
--   get_user_personal_account_id(), which is opaque-plpgsql after B1).
--
-- Behavior equivalence:
--   The new policy USING(public.org_profile_readable_by_cardholder(account_id))
--   grants SELECT on an organization_profiles row iff
--     EXISTS (
--       SELECT 1 FROM public.cards c
--       WHERE c.cardholder_id = get_user_personal_account_id()
--         AND c.organization_id = organization_profiles.account_id
--         AND c.status = 'activated'
--     )
--   which is identical to the previous inline predicate.
-- ---------------------------------------------------------------------------

create or replace function public.org_profile_readable_by_cardholder(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cards c
    where c.cardholder_id = public.get_user_personal_account_id()
      and c.organization_id = target_org_id
      and c.status = 'activated'
  );
$$;

comment on function public.org_profile_readable_by_cardholder(uuid) is
  'SECURITY DEFINER: returns true if the current user (cardholder) has an activated card for the given org. Used to break the cards-RLS expansion chain in organization_profiles policies.';

grant execute on function public.org_profile_readable_by_cardholder(uuid) to authenticated;

drop policy if exists organization_profiles_cardholder_read on public.organization_profiles;

create policy organization_profiles_cardholder_read
  on public.organization_profiles
  for select
  to authenticated
  using (public.org_profile_readable_by_cardholder(account_id));

comment on policy organization_profiles_cardholder_read on public.organization_profiles is
  'Cardholders can view organization profiles for organizations they have activated cards in. Uses SECURITY DEFINER helper to avoid cards-RLS planning explosion.';

-- ---------------------------------------------------------------------------
-- B5. cards_merchant_validate_read policy
--
-- Before: inline EXISTS subquery directly over public.accounts_memberships
--   (an RLS table):
--     EXISTS (SELECT 1 FROM accounts_memberships am
--             WHERE am.user_id = auth.uid() AND am.account_role = 'merchant')
--   → planning ANY query on public.cards expands accounts_memberships' RLS,
--     which recursively expands accounts' 7-policy set. This is the remaining
--     planning-explosion driver for the cards page / distributors page direct
--     reads (converting get_user_personal_account_id alone did NOT help, since
--     this policy's subquery is the actual expansion source).
--
-- Fix: introduce a SECURITY DEFINER helper (opaque to the planner) running the
-- exact same self-scoped EXISTS with RLS bypassed, then rewrite the policy to
-- call only that helper.
--
-- Behavior equivalence: the new predicate is true iff the current user has a
-- membership row with account_role = 'merchant' — identical to the previous
-- inline predicate. The helper is self-scoped to auth.uid(), so SECURITY
-- DEFINER bypassing accounts_memberships RLS exposes nothing extra.
-- ---------------------------------------------------------------------------

create or replace function public.is_current_user_merchant()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.accounts_memberships am
    where am.user_id = (select auth.uid())
      and am.account_role = 'merchant'
  );
$$;

comment on function public.is_current_user_merchant() is
  'SECURITY DEFINER: returns true if the current user has any merchant membership. Used to break the accounts_memberships-RLS expansion chain in the cards merchant-validate policy.';

grant execute on function public.is_current_user_merchant() to authenticated;

drop policy if exists cards_merchant_validate_read on public.cards;

create policy cards_merchant_validate_read
  on public.cards
  for select
  to authenticated
  using (public.is_current_user_merchant());

comment on policy cards_merchant_validate_read on public.cards is
  'Merchants can read cards to validate redemptions. Uses SECURITY DEFINER helper to avoid accounts_memberships-RLS planning explosion.';


-- ===========================================================================
-- LAYER A — Convert get_org_admin_* RPCs to SECURITY DEFINER
-- ===========================================================================
--
-- All these functions are SECURITY INVOKER today. The planner plans their
-- bodies under the caller's RLS context, which means every scan of
-- public.cards, public.organization_profiles, or public.accounts triggers
-- the full 7-policy expansion chain on accounts. Converting to SECURITY
-- DEFINER collapses planning to <1 ms regardless of policy count.
--
-- CRITICAL: each function gains a mandatory authorization guard at the top:
--   if not public.has_role_on_account(org_account_id, 'org_admin') then
--     raise exception 'Access denied' using errcode = '42501';
--   end if;
-- has_role_on_account is SECURITY DEFINER (opaque), queries only
-- accounts_memberships, and resolves auth.uid() correctly inside SECURITY
-- DEFINER context (auth.uid() is session-scoped, not affected by the
-- executor's role switch).
--
-- No overloads are added or removed. Exact signatures, return types, and
-- result semantics are preserved.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- A1. get_org_admin_card_stats
--     Signature: (uuid, timestamptz, timestamptz, uuid) → json
--     Last authoritative definition: 20260520095136
-- ---------------------------------------------------------------------------

create or replace function public.get_org_admin_card_stats(
  org_account_id uuid,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_distributor_id uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role_on_account(org_account_id, 'org_admin') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return (
    select json_build_object(
      'total_cards', count(*)::int,
      'inactive_cards', count(*) filter (where status in ('pending', 'paid'))::int,
      'unassigned_cards', count(*) filter (where distributor_id is null)::int,
      'cards_activated', count(*) filter (where status = 'activated')::int,
      'expired_cards', count(*) filter (where status = 'expired')::int,
      'cancelled_cards', count(*) filter (where status = 'cancelled')::int
    )
    from public.cards
    where organization_id = org_account_id
      and (p_date_from is null or created_at >= p_date_from)
      and (p_date_to is null or created_at <= p_date_to)
      and (p_distributor_id is null or distributor_id = p_distributor_id)
  );
end;
$$;

comment on function public.get_org_admin_card_stats(uuid, timestamptz, timestamptz, uuid) is
  'Get card statistics for an organization admin dashboard with optional filters. SECURITY DEFINER to avoid RLS planning timeout. Authorization guard: caller must be org_admin.';

grant execute on function public.get_org_admin_card_stats(uuid, timestamptz, timestamptz, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A2. get_org_admin_revenue_stats
--     Signature: (uuid, timestamptz, timestamptz, uuid) → json
--     Last authoritative definition: 20260421143016
-- ---------------------------------------------------------------------------

create or replace function public.get_org_admin_revenue_stats(
  org_account_id uuid,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_distributor_id uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_share_per_card_cents integer;
  v_total_count bigint;
  v_activated_count bigint;
  v_pending_count bigint;
  v_stripe_count bigint;
  v_cash_count bigint;
begin
  if not public.has_role_on_account(org_account_id, 'org_admin') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select share_per_card_cents
    into v_share_per_card_cents
    from public.organization_profiles
   where account_id = org_account_id;

  select
    count(*),
    count(*) filter (where status = 'activated'),
    count(*) filter (where status = 'pending'),
    count(*) filter (where payment_type = 'stripe' and status = 'activated'),
    count(*) filter (where payment_type = 'cash' and status = 'activated')
  into
    v_total_count, v_activated_count, v_pending_count, v_stripe_count, v_cash_count
  from public.cards
  where organization_id = org_account_id
    and (p_date_from is null or created_at >= p_date_from)
    and (p_date_to is null or created_at <= p_date_to)
    and (p_distributor_id is null or distributor_id = p_distributor_id);

  return json_build_object(
    'total_revenue_cents',           (v_total_count     * v_share_per_card_cents)::bigint,
    'total_activated_revenue_cents', (v_activated_count * v_share_per_card_cents)::bigint,
    'total_pending_revenue_cents',   (v_pending_count   * v_share_per_card_cents)::bigint,
    'stripe_revenue_cents',          (v_stripe_count    * v_share_per_card_cents)::bigint,
    'cash_revenue_cents',            (v_cash_count      * v_share_per_card_cents)::bigint
  );
end;
$$;

comment on function public.get_org_admin_revenue_stats(uuid, timestamptz, timestamptz, uuid) is
  'Get revenue statistics for an organization admin dashboard with optional filters. Revenue is count * organization_profiles.share_per_card_cents. SECURITY DEFINER; authorization guard: caller must be org_admin.';

grant execute on function public.get_org_admin_revenue_stats(uuid, timestamptz, timestamptz, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A3. get_org_admin_distributor_stats
--     Signature: (uuid, timestamptz, timestamptz) → json
--     Last authoritative definition: 20260520095136
-- ---------------------------------------------------------------------------

create or replace function public.get_org_admin_distributor_stats(
  org_account_id uuid,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role_on_account(org_account_id, 'org_admin') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return (
    select json_build_object(
      'total_distributors', count(distinct am.user_id)::int,
      'active_distributors', count(distinct am.user_id) filter (where a.is_active)::int
    )
    from public.accounts_memberships am
    inner join public.accounts a
      on a.primary_owner_user_id = am.user_id
     and a.is_personal_account = true
    where am.account_id = org_account_id
      and am.account_role = 'distributor'
  );
end;
$$;

comment on function public.get_org_admin_distributor_stats(uuid, timestamptz, timestamptz) is
  'Get distributor statistics for an organization admin dashboard. active_distributors matches distributors_view.is_active. date params kept for forward compatibility but currently ignored. SECURITY DEFINER; authorization guard: caller must be org_admin.';

grant execute on function public.get_org_admin_distributor_stats(uuid, timestamptz, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A4. get_org_admin_sales_over_time
--     Signature: (uuid, int, uuid) → table(month text, sales_count bigint, revenue_cents bigint)
--     Last authoritative definition: 20260421143016
-- ---------------------------------------------------------------------------

create or replace function public.get_org_admin_sales_over_time(
  org_account_id uuid,
  months_back int default 6,
  p_distributor_id uuid default null
)
returns table (
  month text,
  sales_count bigint,
  revenue_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role_on_account(org_account_id, 'org_admin') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return query
    with org_share as (
      select share_per_card_cents
      from public.organization_profiles
      where account_id = org_account_id
    ),
    months as (
      select generate_series(
        date_trunc('month', now()) - ((months_back - 1) * interval '1 month'),
        date_trunc('month', now()),
        '1 month'::interval
      ) as month_start
    )
    select
      to_char(m.month_start, 'Mon YYYY') as month,
      count(c.id) as sales_count,
      (count(c.id) * os.share_per_card_cents)::bigint as revenue_cents
    from months m
    cross join org_share os
    left join public.cards c on
      c.organization_id = org_account_id
      and c.status = 'activated'
      and date_trunc('month', c.activated_at) = m.month_start
      and (p_distributor_id is null or c.distributor_id = p_distributor_id)
    group by m.month_start, os.share_per_card_cents
    order by m.month_start;
end;
$$;

comment on function public.get_org_admin_sales_over_time(uuid, int, uuid) is
  'Get monthly sales data for an organization admin dashboard chart with optional distributor filter. Revenue is count * organization_profiles.share_per_card_cents. SECURITY DEFINER; authorization guard: caller must be org_admin.';

grant execute on function public.get_org_admin_sales_over_time(uuid, int, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A5. get_org_admin_top_distributors
--     Signature: (uuid, int, timestamptz, timestamptz) → table(...)
--     Last authoritative definition: 20260421143016
-- ---------------------------------------------------------------------------

create or replace function public.get_org_admin_top_distributors(
  org_account_id uuid,
  limit_count int default 5,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table (
  distributor_id uuid,
  distributor_name text,
  cards_activated bigint,
  total_cards bigint,
  revenue_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role_on_account(org_account_id, 'org_admin') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return query
    with org_share as (
      select share_per_card_cents
      from public.organization_profiles
      where account_id = org_account_id
    )
    select
      a.id as distributor_id,
      a.name::text as distributor_name,
      count(*) filter (where c.status = 'activated') as cards_activated,
      count(*) as total_cards,
      (count(*) filter (where c.status = 'activated') * os.share_per_card_cents)::bigint as revenue_cents
    from public.accounts_memberships am
    cross join org_share os
    inner join public.accounts a on a.primary_owner_user_id = am.user_id and a.is_personal_account = true
    inner join public.cards c on c.distributor_id = a.id
    where am.account_id = org_account_id
      and am.account_role = 'distributor'
      and c.organization_id = org_account_id
      and (p_date_from is null or c.created_at >= p_date_from)
      and (p_date_to is null or c.created_at <= p_date_to)
    group by a.id, a.name, os.share_per_card_cents
    order by revenue_cents desc
    limit limit_count;
end;
$$;

comment on function public.get_org_admin_top_distributors(uuid, int, timestamptz, timestamptz) is
  'Get top performing distributors for an organization admin dashboard with optional date filter. Revenue is count * organization_profiles.share_per_card_cents. SECURITY DEFINER; authorization guard: caller must be org_admin.';

grant execute on function public.get_org_admin_top_distributors(uuid, int, timestamptz, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A6. get_org_admin_cards_distribution
--     Signature: (uuid, timestamptz, timestamptz, uuid) → json
--     Last authoritative definition: 20260421143016
-- ---------------------------------------------------------------------------

create or replace function public.get_org_admin_cards_distribution(
  org_account_id uuid,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_distributor_id uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_share_per_card_cents integer;
  v_assigned_cards bigint;
  v_unassigned_cards bigint;
  v_activated_cards bigint;
  v_pending_cards bigint;
begin
  if not public.has_role_on_account(org_account_id, 'org_admin') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select share_per_card_cents
    into v_share_per_card_cents
    from public.organization_profiles
   where account_id = org_account_id;

  select
    count(*) filter (where distributor_id is not null),
    count(*) filter (where distributor_id is null),
    count(*) filter (where status = 'activated'),
    count(*) filter (where status = 'pending')
  into
    v_assigned_cards, v_unassigned_cards, v_activated_cards, v_pending_cards
  from public.cards
  where organization_id = org_account_id
    and (p_date_from is null or created_at >= p_date_from)
    and (p_date_to is null or created_at <= p_date_to)
    and (p_distributor_id is null or distributor_id = p_distributor_id);

  return json_build_object(
    'assigned_cards',   v_assigned_cards::int,
    'unassigned_cards', v_unassigned_cards::int,
    'activated_cards',  v_activated_cards::int,
    'pending_cards',    v_pending_cards::int,
    'total_raised_cents', (v_activated_cards * v_share_per_card_cents)::bigint
  );
end;
$$;

comment on function public.get_org_admin_cards_distribution(uuid, timestamptz, timestamptz, uuid) is
  'Get card distribution stats for an organization admin dashboard donut chart with optional filters. Total raised is activated_count * organization_profiles.share_per_card_cents. SECURITY DEFINER; authorization guard: caller must be org_admin.';

grant execute on function public.get_org_admin_cards_distribution(uuid, timestamptz, timestamptz, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A7. get_org_admin_card_type_split
--     Signature: (uuid, timestamptz, timestamptz, uuid) → json
--     Last authoritative definition: 20260508100446
-- ---------------------------------------------------------------------------

create or replace function public.get_org_admin_card_type_split(
  org_account_id uuid,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_distributor_id uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_share_per_card_cents integer;
  v_physical_total bigint;
  v_physical_activated bigint;
  v_digital_total bigint;
  v_digital_activated bigint;
begin
  if not public.has_role_on_account(org_account_id, 'org_admin') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select coalesce(share_per_card_cents, 0)
    into v_share_per_card_cents
    from public.organization_profiles
   where account_id = org_account_id;

  select
    count(*) filter (where card_type = 'physical'),
    count(*) filter (where card_type = 'physical' and status = 'activated'),
    count(*) filter (where card_type = 'digital'),
    count(*) filter (where card_type = 'digital' and status = 'activated')
  into
    v_physical_total, v_physical_activated, v_digital_total, v_digital_activated
  from public.cards
  where organization_id = org_account_id
    and (p_date_from is null or created_at >= p_date_from)
    and (p_date_to is null or created_at <= p_date_to)
    and (p_distributor_id is null or distributor_id = p_distributor_id);

  return json_build_object(
    'physical_total',         v_physical_total::int,
    'physical_activated',     v_physical_activated::int,
    'digital_total',          v_digital_total::int,
    'digital_activated',      v_digital_activated::int,
    'physical_revenue_cents', (v_physical_activated * v_share_per_card_cents)::bigint,
    'digital_revenue_cents',  (v_digital_activated  * v_share_per_card_cents)::bigint
  );
end;
$$;

comment on function public.get_org_admin_card_type_split(uuid, timestamptz, timestamptz, uuid) is
  'Physical vs digital card counts and revenue for an org-admin dashboard split tile. Revenue = activated_count * share_per_card_cents. SECURITY DEFINER; authorization guard: caller must be org_admin.';

grant execute on function public.get_org_admin_card_type_split(uuid, timestamptz, timestamptz, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A8. get_org_admin_recent_activations
--     Signature: (uuid, int, timestamptz, timestamptz, uuid) → table(...)
--     Last authoritative definition: 20260523084620
--
--     Note: this function was already SECURITY INVOKER and does a LEFT JOIN
--     to public.accounts for cardholder/distributor/org name resolution.
--     The 20260523084620 migration introduced accounts_org_admin_view_cardholders
--     to fix null cardholder_name. With SECURITY DEFINER that policy is
--     bypassed entirely — the join works unconditionally, which is correct
--     (the authorization guard already confirms org_admin role). The digital
--     display_code branch (D-padded) from 20260523084620 is preserved exactly.
-- ---------------------------------------------------------------------------

create or replace function public.get_org_admin_recent_activations(
  org_account_id uuid,
  limit_count int default 10,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_distributor_id uuid default null
)
returns table (
  activation_id uuid,
  display_code text,
  cardholder_name text,
  distributor_name text,
  activated_at timestamptz,
  price_cents int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role_on_account(org_account_id, 'org_admin') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return query
    select
      c.id as activation_id,
      case
        when c.card_type = 'digital' then
          case
            when c.digital_card_number is not null
              then 'D-' || lpad(c.digital_card_number::text, 6, '0')
            else 'D'
          end
        else
          coalesce(b.prefix, org.card_prefix, 'CARD') || '-' || coalesce(c.card_number::text, '?')
      end as display_code,
      cardholder.name::text as cardholder_name,
      distributor.name::text as distributor_name,
      c.activated_at,
      c.price_cents
    from public.cards c
    left join public.batches b on c.batch_id = b.id
    left join public.accounts org on c.organization_id = org.id
    left join public.accounts cardholder on c.cardholder_id = cardholder.id
    left join public.accounts distributor on c.distributor_id = distributor.id
    where c.organization_id = org_account_id
      and c.status = 'activated'
      and c.activated_at is not null
      and (p_date_from is null or c.created_at >= p_date_from)
      and (p_date_to is null or c.created_at <= p_date_to)
      and (p_distributor_id is null or c.distributor_id = p_distributor_id)
    order by c.activated_at desc
    limit limit_count;
end;
$$;

comment on function public.get_org_admin_recent_activations(uuid, int, timestamptz, timestamptz, uuid) is
  'Get recent card activations for an organization admin dashboard with optional filters. Handles both physical (prefix-number) and digital (D-padded-number) cards. SECURITY DEFINER; authorization guard: caller must be org_admin.';

grant execute on function public.get_org_admin_recent_activations(uuid, int, timestamptz, timestamptz, uuid) to authenticated, service_role;
