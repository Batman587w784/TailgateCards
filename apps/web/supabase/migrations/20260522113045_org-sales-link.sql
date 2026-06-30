-- Migration: Organization Sales Link
--
-- Adds an org-direct digital-card sales link, parallel to the existing
-- distributor link. Cards sold through an org link have distributor_id = NULL.
--
-- 1. create_digital_card: drop + recreate with p_distributor_id moved last
--    and defaulted to NULL. The membership trust-boundary check (added in
--    20260510142508_validate-distributor-membership-in-create-digital-card.sql)
--    now only runs when p_distributor_id is provided. The org-direct path is
--    verified separately by the caller via get_organization_buy_page.
--
-- 2. get_organization_buy_page: anon-safe display payload RPC keyed on
--    accounts.slug — mirrors get_distributor_buy_page minus the distributor.

-- ============================================================================
-- 1. create_digital_card — make distributor optional
-- ============================================================================

drop function public.create_digital_card(uuid, uuid, text, text, integer);

create or replace function public.create_digital_card(
  p_organization_id uuid,
  p_payment_intent_id text,
  p_buyer_email text,
  p_price_cents integer,
  p_distributor_id uuid default null
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

  -- Idempotency: same payment_intent_id => same card. Runs before the
  -- trust-boundary check so a webhook retry for an already-minted card
  -- returns the existing row even if the distributor's membership was
  -- revoked in the meantime.
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

  -- Trust-boundary check (only when a distributor is named): the named
  -- distributor must actually be a 'distributor' member of the named
  -- organization. p_distributor_id is the distributor's personal-account id
  -- (= user_id for personal accounts). Org-direct sales (p_distributor_id
  -- is null) skip this check; their authenticity is enforced by the action
  -- that resolved accounts.slug via get_organization_buy_page.
  if p_distributor_id is not null then
    if not exists (
      select 1
        from public.accounts_memberships am
        join public.accounts a
          on a.primary_owner_user_id = am.user_id
         and a.is_personal_account = true
       where a.id = p_distributor_id
         and am.account_id = p_organization_id
         and am.account_role = 'distributor'
    ) then
      raise exception 'Distributor % is not a member of organization % with role distributor',
        p_distributor_id, p_organization_id;
    end if;
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

comment on function public.create_digital_card(uuid, text, text, integer, uuid)
  is 'Idempotent digital-card creation called from the Stripe webhook and the inline confirm-and-activate action. Idempotent on stripe_payment_intent_id. When p_distributor_id is provided, validates the (distributor, organization) membership before insert; when null, the card is attributed directly to the organization.';

revoke all on function public.create_digital_card(uuid, text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.create_digital_card(uuid, text, text, integer, uuid) to service_role;

-- ============================================================================
-- 2. get_organization_buy_page — anon-safe org payload for /activate/o/{slug}
-- ============================================================================

create or replace function public.get_organization_buy_page(p_slug text)
returns table (
  organization_id uuid,
  organization_name text,
  organization_picture_url text,
  price_cents integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_slug is null or length(p_slug) = 0 then
    return;
  end if;

  return query
    select
      org.id                                              as organization_id,
      coalesce(op.organization_name, org.name)::text      as organization_name,
      org.picture_url::text                               as organization_picture_url,
      coalesce(op.card_price_cents, 2500)::integer        as price_cents
    from public.accounts org
    left join public.organization_profiles op on op.account_id = org.id
   where org.slug = p_slug
     and org.is_personal_account = false
   limit 1;
end;
$$;

comment on function public.get_organization_buy_page(text) is 'Returns display-safe org data for the public /activate/o/{slug} buy page. SECURITY DEFINER so anon can call without broader access to accounts.';

grant execute on function public.get_organization_buy_page(text) to anon, authenticated;
