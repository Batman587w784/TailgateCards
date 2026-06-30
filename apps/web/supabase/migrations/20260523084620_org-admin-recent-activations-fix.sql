/*
 * -------------------------------------------------------
 * Migration: Fix org-admin Recent Activations
 *
 * Two bugs in the org_admin dashboard's "Recent Activations" card:
 *
 *   1. cardholder_name was always null. get_org_admin_recent_activations
 *      is SECURITY INVOKER, and the LEFT JOIN to public.accounts for the
 *      cardholder row is filtered out by the accounts_read policy — an
 *      org_admin has no role/team-membership on a cardholder's personal
 *      account, so RLS hides the row and the join returns nulls.
 *
 *      Fix: a new accounts RLS policy (accounts_org_admin_view_cardholders)
 *      letting org_admins read cardholder accounts whose cards belong to an
 *      org they administer. Recursion-safe via a SECURITY DEFINER helper
 *      (is_cardholder_in_my_orgs) that queries cards + accounts_memberships
 *      with RLS bypassed. Mirrors the existing is_card_organization /
 *      accounts_cardholder_view_org pattern from 18-tailgate-roles.sql.
 *
 *   2. display_code was empty for digital cards. The formula used
 *      c.card_number::text, which is null for card_type = 'digital' (M6
 *      moved the number to digital_card_number and dropped batch_id).
 *      String concat with null collapses the whole expression to null,
 *      so the UI rendered "Card ID: " with nothing after it.
 *
 *      Fix: branch on card_type and use the same formula as
 *      trigger_log_card_activity ('D-{padded digital_card_number}' for
 *      digital, '{prefix}-{card_number}' for physical).
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Helper + RLS policy for org_admin -> cardholder accounts
-- ============================================================

create or replace function public.is_cardholder_in_my_orgs(target_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cards c
    inner join public.accounts_memberships am on am.account_id = c.organization_id
    where c.cardholder_id = target_id
      and am.user_id = (select auth.uid())
      and am.account_role = 'org_admin'
  );
$$;

grant execute on function public.is_cardholder_in_my_orgs(uuid) to authenticated;

create policy accounts_org_admin_view_cardholders
  on public.accounts
  for select
  to authenticated
  using (public.is_cardholder_in_my_orgs(id));

-- ============================================================
-- SECTION 2: Digital-card-aware display_code in recent activations
-- ============================================================

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
language sql
stable
security invoker
set search_path = ''
as $$
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
    cardholder.name as cardholder_name,
    distributor.name as distributor_name,
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
$$;

comment on function public.get_org_admin_recent_activations(uuid, int, timestamptz, timestamptz, uuid) is
  'Get recent card activations for an organization admin dashboard with optional filters. Handles both physical (prefix-number) and digital (D-padded-number) cards.';

grant execute on function public.get_org_admin_recent_activations(uuid, int, timestamptz, timestamptz, uuid) to authenticated, service_role;
