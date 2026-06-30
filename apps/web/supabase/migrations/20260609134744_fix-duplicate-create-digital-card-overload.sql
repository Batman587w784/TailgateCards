-- Fixes an ambiguous-overload regression in public.create_digital_card.
--
-- 20260522113045_org-sales-link dropped the old (uuid, uuid, text, text, integer)
-- overload and recreated the function with the canonical signature
-- (uuid, text, text, integer, uuid) — p_distributor_id last, defaulting to NULL so
-- org-direct sales can omit it.
--
-- 20260524110937_set-assigned-at-in-create-digital-card then tried to add an
-- assigned_at stamp via `create or replace`, but used the OLD parameter ORDER
-- (uuid, uuid, text, text, integer). Postgres identifies a function by its
-- argument-type signature, so `create or replace` with a different type order does
-- NOT replace the canonical function — it CREATES A SECOND overload. Both overloads
-- expose the identical five named parameters, so a PostgREST RPC call that passes
-- all five names (distributor sales, e.g. /activate/d/<slug>) matches both and
-- fails with "Could not choose the best candidate function" => CARD_CREATION_FAILED.
-- (Org-direct sales omit p_distributor_id, so only the default-NULL overload could
-- match — which is why they kept working.)
--
-- That migration also regressed distributor-optionality: its body made
-- p_distributor_id required again, undoing org-direct support.
--
-- This migration drops the stray (uuid, uuid, text, text, integer) overload and
-- recreates the single canonical function, merging both intents: distributor stays
-- optional (org-direct sales allowed) AND assigned_at is stamped when — and only
-- when — a distributor is named.

drop function if exists public.create_digital_card(uuid, uuid, text, text, integer);

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
    -- Digital cards bought through a distributor buy page are born assigned;
    -- org-direct cards have no assignee, so leave assigned_at null.
    case when p_distributor_id is not null then now() else null end,
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
  is 'Idempotent digital-card creation called from the Stripe webhook and the inline confirm-and-activate action. Idempotent on stripe_payment_intent_id. When p_distributor_id is provided, validates the (distributor, organization) membership and stamps assigned_at = now(); when null, the card is attributed directly to the organization with no assignment.';

revoke all on function public.create_digital_card(uuid, text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.create_digital_card(uuid, text, text, integer, uuid) to service_role;
