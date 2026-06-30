-- Migration: M6 — Digital Card Sales
--
-- Adds digital cards as a parallel issuance line to physical cards:
--   * card_type enum ('physical' | 'digital')
--   * cards.{card_type, claim_token, digital_card_number, buyer_email, purchased_at}
--   * organization_digital_card_counters per-org monotonic counter
--   * next_digital_card_number / create_digital_card helpers
--   * get_distributor_buy_page anon-safe display payload RPC
--   * activate_digital_card claim-by-token RPC
--   * get_digital_card_for_activation RPC for token-gated buyer lookups
--   * accounts_memberships.share_slug for per-distributor sales links
--     (personal accounts can't carry slugs themselves — 03-accounts.sql
--     constraint accounts_slug_null_if_personal_account_true)
--
-- Strictly additive: existing physical cards default to card_type='physical'.
-- card_number is made nullable so digital cards can leave it NULL (their
-- numbering lives in digital_card_number). Physical numbering uniqueness is
-- left to the existing per-batch constraint cards_batch_number_unique.

-- ============================================================================
-- 1. Enum
-- ============================================================================

create type public.card_type as enum ('physical', 'digital');
comment on type public.card_type is 'Whether a card is a physical NFC card or a digital-only card sold via a distributor link';

-- ============================================================================
-- 2. Columns on cards
-- ============================================================================

alter table public.cards
  add column card_type public.card_type not null default 'physical',
  add column claim_token text,
  add column digital_card_number integer,
  add column buyer_email text,
  add column purchased_at timestamptz;

create unique index cards_claim_token_unique
  on public.cards (claim_token)
  where claim_token is not null;

comment on column public.cards.card_type is 'physical (NFC card in a batch) or digital (sold via distributor link)';
comment on column public.cards.claim_token is 'Opaque base64url token emailed to the digital card buyer; null for physical cards';
comment on column public.cards.digital_card_number is 'Per-org monotonic number for digital cards; null for physical cards';
comment on column public.cards.buyer_email is 'Email captured at Stripe checkout for digital cards; null for physical cards';
comment on column public.cards.purchased_at is 'Timestamp of successful Stripe payment for digital cards';

-- Physical cards already have card_number. Make it nullable so digital cards
-- can leave it null (digital numbering lives in digital_card_number).
alter table public.cards alter column card_number drop not null;

-- Physical card numbering uniqueness is enforced per-batch by
-- cards_batch_number_unique (batch_id, card_number), introduced in
-- 20260110184249_fix-card-number-uniqueness.sql, which deliberately replaced
-- the original per-org constraint (cards_org_number_unique). That batch-level
-- constraint still holds after this migration: digital cards leave card_number
-- NULL, so they don't participate in it. We therefore do NOT add a per-org
-- physical index here — doing so would re-introduce the org-level uniqueness
-- that was intentionally removed and would reject legitimate per-batch number
-- reuse. The drop below is a harmless no-op on environments past Dec 2025.
alter table public.cards drop constraint if exists cards_org_number_unique;

create unique index cards_org_digital_number_uniq
  on public.cards (organization_id, digital_card_number)
  where card_type = 'digital';

-- Shape constraints
alter table public.cards
  add constraint cards_physical_has_card_number
    check (card_type <> 'physical' or card_number is not null);

alter table public.cards
  add constraint cards_digital_has_claim_token
    check (card_type <> 'digital' or claim_token is not null);

alter table public.cards
  add constraint cards_digital_has_number
    check (card_type <> 'digital' or digital_card_number is not null);

alter table public.cards
  add constraint cards_digital_has_no_batch
    check (card_type <> 'digital' or batch_id is null);

create index ix_cards_card_type on public.cards (card_type);

-- ============================================================================
-- 3. Per-org monotonic counter for digital card numbering
-- ============================================================================

create table public.organization_digital_card_counters (
  organization_id uuid primary key references public.accounts(id) on delete cascade,
  next_number integer not null default 1,
  updated_at timestamptz not null default now()
);

comment on table public.organization_digital_card_counters is 'Per-organization monotonic sequence used to assign digital_card_number on digital card creation';

alter table public.organization_digital_card_counters enable row level security;

revoke all on public.organization_digital_card_counters from authenticated, service_role, anon;
-- Counter is mutated only by next_digital_card_number (security definer); no
-- direct grants are required.

-- ============================================================================
-- 4. accounts_memberships.share_slug — per-distributor sales-link identifier
-- ============================================================================
--
-- Slug-per-membership rather than slug-per-account: a personal account can't
-- carry a slug (constraint in 03-accounts.sql), and we need to distinguish
-- distributors when one user is a distributor for multiple orgs.

alter table public.accounts_memberships
  add column share_slug text;

create unique index accounts_memberships_share_slug_unique
  on public.accounts_memberships (share_slug)
  where share_slug is not null;

comment on column public.accounts_memberships.share_slug is 'Public-facing slug used in /activate/d/{slug} for distributor digital sales links';

-- Generate a share_slug for distributor memberships. Format:
--   {kit.slugify(personal account name) | "dist"} - {6-char base36 suffix}
-- Re-tries on collision against accounts_memberships.share_slug.
create or replace function public.generate_distributor_share_slug(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_candidate text;
  v_attempt integer := 0;
begin
  select coalesce(nullif(kit.slugify(name), ''), 'dist')
    into v_base
    from public.accounts
   where primary_owner_user_id = p_user_id
     and is_personal_account = true
   limit 1;

  v_base := coalesce(v_base, 'dist');

  loop
    v_candidate := v_base
      || '-'
      || lower(substring(translate(encode(extensions.gen_random_bytes(6), 'base64'),
                                   '+/=', '') from 1 for 6));

    perform 1 from public.accounts_memberships where share_slug = v_candidate;
    if not found then
      return v_candidate;
    end if;

    v_attempt := v_attempt + 1;
    if v_attempt > 8 then
      raise exception 'Failed to generate unique share_slug after 8 attempts';
    end if;
  end loop;
end;
$$;

comment on function public.generate_distributor_share_slug(uuid) is 'Returns a unique share_slug for a distributor membership, derived from the user''s personal account name + random suffix';

revoke all on function public.generate_distributor_share_slug(uuid) from public, anon, authenticated;

-- Trigger: new distributor memberships get a share_slug automatically.
create or replace function public.trigger_set_distributor_share_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_role = 'distributor' and new.share_slug is null then
    new.share_slug := public.generate_distributor_share_slug(new.user_id);
  end if;
  return new;
end;
$$;

create trigger accounts_memberships_set_share_slug
  before insert or update of account_role on public.accounts_memberships
  for each row execute function public.trigger_set_distributor_share_slug();

-- Backfill existing distributor memberships.
-- kit.prevent_memberships_update forbids updates to any column other than
-- account_role, so disable the trigger for the duration of this backfill.
-- Safe: the only mutation here is share_slug on rows with share_slug IS NULL.
alter table public.accounts_memberships
  disable trigger prevent_memberships_update_check;

do $$
declare
  v_row record;
  v_slug text;
begin
  for v_row in
    select user_id, account_id
      from public.accounts_memberships
     where account_role = 'distributor'
       and share_slug is null
  loop
    v_slug := public.generate_distributor_share_slug(v_row.user_id);
    update public.accounts_memberships
       set share_slug = v_slug
     where user_id = v_row.user_id
       and account_id = v_row.account_id;
  end loop;
end$$;

alter table public.accounts_memberships
  enable trigger prevent_memberships_update_check;

-- ============================================================================
-- 5. Helper functions
-- ============================================================================

-- Atomically claim and return the next digital_card_number for an org.
create or replace function public.next_digital_card_number(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assigned integer;
begin
  insert into public.organization_digital_card_counters (organization_id, next_number)
  values (p_organization_id, 2)
  on conflict (organization_id) do update
    set next_number = public.organization_digital_card_counters.next_number + 1,
        updated_at = now()
  returning public.organization_digital_card_counters.next_number - 1 into v_assigned;

  return v_assigned;
end;
$$;

comment on function public.next_digital_card_number(uuid) is 'Atomically returns the next per-org digital card number, creating the counter row if missing';

-- Internal: only callable via create_digital_card (security definer chain).
revoke all on function public.next_digital_card_number(uuid) from public, anon, authenticated;

-- Idempotently create a digital card from a successful Stripe webhook.
-- Returns the row id and claim_token for the newly created (or already
-- existing, by stripe_payment_intent_id) card.
create or replace function public.create_digital_card(
  p_organization_id uuid,
  p_distributor_id uuid,
  p_payment_intent_id text,
  p_buyer_email text,
  p_price_cents integer
)
returns table (card_id uuid, claim_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card_id uuid;
  v_token text;
  v_number integer;
  v_existing_token text;
begin
  if p_organization_id is null then
    raise exception 'organization_id is required';
  end if;

  if p_payment_intent_id is null or length(p_payment_intent_id) = 0 then
    raise exception 'payment_intent_id is required';
  end if;

  -- Idempotency: same payment_intent_id => same card
  select c.id, c.claim_token
    into v_card_id, v_existing_token
    from public.cards c
   where c.stripe_payment_intent_id = p_payment_intent_id
   limit 1;

  if v_card_id is not null then
    card_id := v_card_id;
    claim_token := v_existing_token;
    return next;
    return;
  end if;

  v_token := replace(replace(replace(
    encode(extensions.gen_random_bytes(24), 'base64'),
    '+', '-'), '/', '_'), '=', '');

  v_number := public.next_digital_card_number(p_organization_id);

  insert into public.cards (
    organization_id,
    distributor_id,
    card_type,
    status,
    claim_token,
    digital_card_number,
    buyer_email,
    purchased_at,
    paid_at,
    price_cents,
    payment_type,
    stripe_payment_intent_id,
    stripe_customer_email
  ) values (
    p_organization_id,
    p_distributor_id,
    'digital',
    'paid',
    v_token,
    v_number,
    p_buyer_email,
    now(),
    now(),
    coalesce(p_price_cents, 0),
    'stripe',
    p_payment_intent_id,
    p_buyer_email
  )
  returning id into v_card_id;

  card_id := v_card_id;
  claim_token := v_token;
  return next;
end;
$$;

comment on function public.create_digital_card(uuid, uuid, text, text, integer) is 'Idempotent digital-card creation called from the Stripe webhook. Idempotent on stripe_payment_intent_id.';

revoke all on function public.create_digital_card(uuid, uuid, text, text, integer) from public, anon, authenticated;
-- Service role (admin client) calls this from the webhook route handler.
grant execute on function public.create_digital_card(uuid, uuid, text, text, integer) to service_role;

-- Anon-safe display payload for /activate/d/{slug}. Resolves the slug against
-- accounts_memberships.share_slug (added below).
create or replace function public.get_distributor_buy_page(p_slug text)
returns table (
  distributor_id uuid,
  distributor_name text,
  organization_id uuid,
  organization_name text,
  organization_picture_url text,
  price_cents integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
begin
  if p_slug is null or length(p_slug) = 0 then
    return;
  end if;

  select am.user_id, am.account_id
    into v_user_id, v_org_id
    from public.accounts_memberships am
   where am.share_slug = p_slug
     and am.account_role = 'distributor'
   limit 1;

  if v_user_id is null then
    return;
  end if;

  return query
    select
      d.id                                                as distributor_id,
      d.name::text                                        as distributor_name,
      org.id                                              as organization_id,
      coalesce(op.organization_name, org.name)::text      as organization_name,
      org.picture_url::text                               as organization_picture_url,
      coalesce(op.card_price_cents, 2500)::integer        as price_cents
    from public.accounts d
    join public.accounts org on org.id = v_org_id
    left join public.organization_profiles op on op.account_id = org.id
   where d.primary_owner_user_id = v_user_id
     and d.is_personal_account = true
   limit 1;
end;
$$;

comment on function public.get_distributor_buy_page(text) is 'Returns display-safe distributor + org data for the public /activate/d/{slug} buy page. SECURITY DEFINER so anon can call without broader access to accounts.';

grant execute on function public.get_distributor_buy_page(text) to anon, authenticated;

-- Activate a digital card by claim_token: assigns the card to the current
-- user's personal account, sets status='activated', activated_at, expires_at.
-- Mirrors activate_card but keys off claim_token and works with status='paid'.
create or replace function public.activate_digital_card(
  p_claim_token text,
  p_validity_days integer default 365
)
returns public.cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.cards;
  v_user_account_id uuid;
begin
  v_user_account_id := public.get_user_personal_account_id();

  if v_user_account_id is null then
    raise exception 'User must be authenticated';
  end if;

  if p_claim_token is null or length(p_claim_token) = 0 then
    raise exception 'claim_token is required';
  end if;

  select * into v_card
    from public.cards
   where claim_token = p_claim_token
     and card_type = 'digital'
   for update;

  if v_card is null then
    raise exception 'Card not found';
  end if;

  if v_card.cardholder_id is not null then
    raise exception 'Card is already assigned';
  end if;

  if v_card.status not in ('pending', 'paid') then
    raise exception 'Card cannot be activated (status: %)', v_card.status;
  end if;

  update public.cards
     set cardholder_id = v_user_account_id,
         status        = 'activated',
         activated_at  = now(),
         expires_at    = now() + (p_validity_days || ' days')::interval
   where id = v_card.id
   returning * into v_card;

  return v_card;
end;
$$;

comment on function public.activate_digital_card(text, integer) is 'Claims a digital card by its claim_token for the current authenticated user';

grant execute on function public.activate_digital_card(text, integer) to authenticated;

-- ============================================================================
-- 6. Token-gated lookup for the buyer-facing /activate/{token} flow
-- ============================================================================
--
-- The existing `cards_public_read_for_activation` policy lets anon read every
-- cards row (USING (true)). Selecting claim_token over that policy would let
-- anon enumerate all live tokens. Instead, expose a SECURITY DEFINER RPC that
-- takes the claim_token as a parameter and returns a sanitized payload — the
-- caller only learns about the card if they already hold the token.

create or replace function public.get_digital_card_for_activation(p_claim_token text)
returns table (
  id uuid,
  status public.card_status,
  digital_card_number integer,
  organization_id uuid,
  organization_name text,
  organization_picture_url text,
  price_cents integer,
  buyer_email text,
  cardholder_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_claim_token is null or length(p_claim_token) = 0 then
    return;
  end if;

  return query
    select
      c.id,
      c.status,
      c.digital_card_number,
      c.organization_id,
      coalesce(op.organization_name, org.name)::text as organization_name,
      org.picture_url::text                          as organization_picture_url,
      c.price_cents,
      c.buyer_email::text,
      c.cardholder_id
    from public.cards c
    join public.accounts org on org.id = c.organization_id
    left join public.organization_profiles op on op.account_id = c.organization_id
   where c.claim_token = p_claim_token
     and c.card_type = 'digital';
end;
$$;

comment on function public.get_digital_card_for_activation(text) is 'Token-gated card lookup for the digital activation flow. Returns sanitized fields only; never exposes the claim_token to other rows.';

-- ============================================================================
-- 7. Physical / Digital split RPCs for org-admin and super-admin dashboards.
--    Both are SECURITY INVOKER so RLS still gates the underlying cards rows.
--    Revenue uses share_per_card_cents (org_admin: per-org row in
--    organization_profiles; super-admin: average across orgs scoped by filter).
-- ============================================================================

create or replace function public.get_org_admin_card_type_split(
  org_account_id uuid,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_distributor_id uuid default null
)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with org_share as (
    select share_per_card_cents
    from public.organization_profiles
    where account_id = org_account_id
  ),
  buckets as (
    select
      count(*) filter (where card_type = 'physical') as physical_total,
      count(*) filter (where card_type = 'physical' and status = 'activated') as physical_activated,
      count(*) filter (where card_type = 'digital') as digital_total,
      count(*) filter (where card_type = 'digital' and status = 'activated') as digital_activated
    from public.cards
    where organization_id = org_account_id
      and (p_date_from is null or created_at >= p_date_from)
      and (p_date_to is null or created_at <= p_date_to)
      and (p_distributor_id is null or distributor_id = p_distributor_id)
  )
  select json_build_object(
    'physical_total', b.physical_total::int,
    'physical_activated', b.physical_activated::int,
    'digital_total', b.digital_total::int,
    'digital_activated', b.digital_activated::int,
    'physical_revenue_cents', (b.physical_activated * coalesce(os.share_per_card_cents, 0))::bigint,
    'digital_revenue_cents', (b.digital_activated * coalesce(os.share_per_card_cents, 0))::bigint
  )
  from buckets b
  left join org_share os on true;
$$;

comment on function public.get_org_admin_card_type_split(uuid, timestamptz, timestamptz, uuid) is
  'Physical vs digital card counts and revenue for an org-admin dashboard split tile. Revenue = activated_count * share_per_card_cents.';

grant execute on function public.get_org_admin_card_type_split(uuid, timestamptz, timestamptz, uuid)
  to authenticated, service_role;

-- Super-admin variant. Revenue here is summed using each org's own
-- share_per_card_cents so a multi-org view stays accurate.
create or replace function public.get_admin_card_type_split(
  p_organization_id uuid default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with scoped as (
    select c.card_type, c.status, op.share_per_card_cents
    from public.cards c
    left join public.organization_profiles op on op.account_id = c.organization_id
    where (p_organization_id is null or c.organization_id = p_organization_id)
      and (p_date_from is null or c.created_at >= p_date_from)
      and (p_date_to is null or c.created_at <= p_date_to)
  )
  select json_build_object(
    'physical_total', count(*) filter (where card_type = 'physical')::int,
    'physical_activated', count(*) filter (where card_type = 'physical' and status = 'activated')::int,
    'digital_total', count(*) filter (where card_type = 'digital')::int,
    'digital_activated', count(*) filter (where card_type = 'digital' and status = 'activated')::int,
    'physical_revenue_cents', coalesce(sum(coalesce(share_per_card_cents, 0)) filter (where card_type = 'physical' and status = 'activated'), 0)::bigint,
    'digital_revenue_cents',  coalesce(sum(coalesce(share_per_card_cents, 0)) filter (where card_type = 'digital'  and status = 'activated'), 0)::bigint
  )
  from scoped;
$$;

comment on function public.get_admin_card_type_split(uuid, timestamptz, timestamptz) is
  'Physical vs digital card counts and revenue across the platform (or a single org). Revenue is summed using each org''s share_per_card_cents.';

grant execute on function public.get_admin_card_type_split(uuid, timestamptz, timestamptz)
  to authenticated, service_role;

-- ============================================================================
-- 8. Patch trigger_log_card_activity to handle digital cards. The original
--    trigger (20251217034620) builds the display code from org.card_prefix
--    and cards.card_number; digital cards leave card_number NULL so the
--    concatenation produced a NULL message and violated the activities
--    not-null constraint on update.
-- ============================================================================

create or replace function public.trigger_log_card_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_name text;
  v_org_prefix text;
  v_actor_name text;
  v_display_code text;
begin
  select name, card_prefix into v_org_name, v_org_prefix
  from public.accounts
  where id = new.organization_id;

  if new.card_type = 'digital' then
    v_display_code := case
      when new.digital_card_number is not null
        then 'D-' || lpad(new.digital_card_number::text, 6, '0')
      else 'D'
    end;
  else
    v_display_code := coalesce(v_org_prefix, 'CARD') || '-' || coalesce(new.card_number::text, '?');
  end if;

  if new.distributor_id is not null then
    select name into v_actor_name from public.accounts where id = new.distributor_id;
  end if;

  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'paid' then
    perform public.log_activity(
      'card_sold'::public.activity_type,
      coalesce(v_actor_name, v_org_name) || ' sold card ' || v_display_code || ' - ' || new.payment_type,
      new.distributor_id,
      new.organization_id,
      'card',
      new.id,
      jsonb_build_object('card_code', v_display_code, 'payment_type', new.payment_type, 'price_cents', new.price_cents)
    );
  end if;

  if tg_op = 'UPDATE' and old.status != 'activated' and new.status = 'activated' then
    perform public.log_activity(
      'card_activated'::public.activity_type,
      'Card ' || v_display_code || ' activated successfully',
      new.cardholder_id,
      new.organization_id,
      'card',
      new.id,
      jsonb_build_object('card_code', v_display_code, 'cardholder_id', new.cardholder_id)
    );
  end if;

  return new;
end;
$$;

comment on function public.trigger_log_card_activity is 'Logs card status changes (sold, activated) to the activities table — handles physical and digital cards.';

grant execute on function public.get_digital_card_for_activation(text) to anon, authenticated;
