-- Migration: M3 / P1 data plumbing — buyer_phone + gross checkout goals
--
-- (1) cards.buyer_phone (E.164), stored at purchase for texting/gifting (P1-5).
-- (2) create_digital_card gains p_buyer_phone (default null) and records it.
-- (3) get_checkout_goals: GROSS campaign figures for the purchase-page goal bars
--     (decision #12), for the chapter and the (optional) distributor, plus the
--     per-card gross/net for the split-disclosure line. Numbers only (no PII).

alter table public.cards
  add column if not exists buyer_phone text;

comment on column public.cards.buyer_phone is 'E.164 buyer phone captured at purchase (for card texting / gifting).';

-- ── create_digital_card: add p_buyer_phone (backward compatible; both callers
--    use named params, so omitting it keeps working) ──────────────────────────
drop function if exists public.create_digital_card(uuid, text, text, integer, uuid);

create or replace function public.create_digital_card(
  p_organization_id uuid,
  p_payment_intent_id text,
  p_buyer_email text,
  p_price_cents integer,
  p_distributor_id uuid default null,
  p_buyer_phone text default null
)
returns table(card_id uuid, claim_token text)
language plpgsql
security definer
set search_path to ''
as $function$
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

  -- Trust-boundary check (only when a distributor is named).
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
    buyer_phone,
    purchased_at,
    paid_at,
    price_cents,
    payment_type,
    stripe_payment_intent_id,
    stripe_customer_email
  ) values (
    p_organization_id,
    p_distributor_id,
    case when p_distributor_id is not null then now() else null end,
    'digital',
    'paid',
    v_token,
    v_number,
    p_buyer_email,
    nullif(btrim(p_buyer_phone), ''),
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
$function$;

grant execute on function public.create_digital_card(uuid, text, text, integer, uuid, text)
  to authenticated, service_role;

-- ── get_checkout_goals: GROSS goal figures for the purchase page (decision #12)
create or replace function public.get_checkout_goals(
  p_org_account_id uuid,
  p_distributor_account_id uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_price int;   -- gross card price (full face value)
  v_share int;   -- net per card (org's cut)
  v_ch_cards bigint;
  v_ch_gross bigint;
  v_mb_cards bigint;
  v_mb_gross bigint;
begin
  select card_price_cents, share_per_card_cents
    into v_price, v_share
  from public.organization_profiles
  where account_id = p_org_account_id;

  if v_price is null then
    return null;
  end if;

  -- "Sold" for a live campaign bar = money received = paid or activated.
  -- REVIEW: this differs from the M2 leaderboard, which counts activated only.
  select count(*) filter (where status in ('paid', 'activated'))
    into v_ch_cards
  from public.cards
  where organization_id = p_org_account_id;
  v_ch_gross := (v_ch_cards * v_price)::bigint;

  if p_distributor_account_id is not null then
    select count(*) filter (where status in ('paid', 'activated'))
      into v_mb_cards
    from public.cards
    where organization_id = p_org_account_id
      and distributor_id = p_distributor_account_id;
    v_mb_gross := (coalesce(v_mb_cards, 0) * v_price)::bigint;
  end if;

  return json_build_object(
    -- per-card gross (face) + net (supports beneficiary), for the split disclosure
    'per_card', json_build_object('price_cents', v_price, 'net_cents', v_share),
    'chapter', json_build_object(
      'cards_sold', v_ch_cards,
      'raised_cents', v_ch_gross,
      'goal_cents', public.auto_goal_cents(v_ch_gross),
      'progress', public.auto_goal_progress(v_ch_gross)
    ),
    'distributor', case when p_distributor_account_id is null then null else json_build_object(
      'cards_sold', coalesce(v_mb_cards, 0),
      'raised_cents', coalesce(v_mb_gross, 0),
      'goal_cents', public.auto_goal_cents(coalesce(v_mb_gross, 0)),
      'progress', public.auto_goal_progress(coalesce(v_mb_gross, 0))
    ) end
  );
end;
$$;

grant execute on function public.get_checkout_goals(uuid, uuid) to anon, authenticated;
