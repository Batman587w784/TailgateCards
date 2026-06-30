-- Digital cards are born already bound to a distributor (the slug that drove
-- the buy page), but `create_digital_card` never populated `cards.assigned_at`.
-- That left every digital card with an empty "Date Assigned" column in the
-- org-admin cards table even though `distributor_id` was set. Replace the RPC
-- so the assignment timestamp is written alongside `distributor_id`.

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

  if p_distributor_id is null then
    raise exception 'distributor_id is required';
  end if;

  -- Idempotency: same payment_intent_id => same card.
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

  -- Trust-boundary check: the named distributor must actually be a
  -- 'distributor' member of the named organization.
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

  v_token := replace(replace(replace(
    encode(extensions.gen_random_bytes(24), 'base64'),
    '+', '-'), '/', '_'), '=', '');

  v_number := public.next_digital_card_number(p_organization_id);

  insert into public.cards (
    organization_id,
    distributor_id,
    assigned_at,
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
    now(),
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

comment on function public.create_digital_card(uuid, uuid, text, text, integer)
  is 'Idempotent digital-card creation called from the Stripe webhook. Idempotent on stripe_payment_intent_id. Validates (distributor, organization) membership and stamps assigned_at = now() since digital cards are born assigned.';

revoke all on function public.create_digital_card(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.create_digital_card(uuid, uuid, text, text, integer) to service_role;
