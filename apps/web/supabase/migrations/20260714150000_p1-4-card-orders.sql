-- ─────────────────────────────────────────────────────────────────────────────
-- P1-4a — multi-card orders. One Stripe PaymentIntent can now fund N digital
-- cards in a single checkout.
--
-- Gift-link model (decided with the user): the buyer activates ONE card to their
-- own account and the remaining N-1 stay unclaimed, each with its own claim
-- token to share/gift. The one-card-per-account rule (ix_cards_cardholder_unique)
-- is intentionally LEFT UNCHANGED — each recipient still claims exactly one card.
--
-- Idempotency moves up a level: `card_orders.stripe_payment_intent_id` is UNIQUE,
-- so a webhook retry for the same PaymentIntent returns the same order + cards
-- instead of creating duplicates. (There is deliberately no unique constraint on
-- cards.stripe_payment_intent_id, so the N cards of one order all carry the PI.)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.card_orders (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.accounts(id) on delete cascade,
  distributor_id uuid references public.accounts(id) on delete set null,
  stripe_payment_intent_id text not null unique,
  buyer_email text,
  buyer_phone text,
  quantity integer not null check (quantity >= 1),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  -- Charge breakdown for the whole order (as charged by Stripe). Nullable so the
  -- order can be recorded even if the caller doesn't pass a full breakdown.
  subtotal_cents integer,
  fee_cents integer,
  tax_cents integer,
  total_cents integer,
  created_at timestamptz not null default now()
);

comment on table public.card_orders is
  'A single digital-card purchase (one Stripe PaymentIntent) funding N cards; gift-link fulfillment.';

alter table public.card_orders enable row level security;

-- No direct client access: orders are written only by the SECURITY DEFINER RPC
-- (runs as owner) and read only via the service_role admin client on the server.
-- No policies for authenticated/anon => deny all.
revoke all on public.card_orders from anon, authenticated;
grant select, insert, update on public.card_orders to service_role;

-- Link each card back to its order.
alter table public.cards
  add column if not exists order_id uuid references public.card_orders(id) on delete set null;

comment on column public.cards.order_id is
  'The card_orders row this card was fulfilled from (multi-card purchases).';

create index if not exists ix_cards_order_id on public.cards (order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- create_digital_card_order — creates (or idempotently returns) an order and its
-- N cards. Mirrors create_digital_card's per-card insert exactly, looped N times.
-- Cards are inserted 'paid' + unclaimed; the caller decides which one to claim.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_digital_card_order(
  p_organization_id uuid,
  p_payment_intent_id text,
  p_buyer_email text,
  p_quantity integer,
  p_unit_price_cents integer,
  p_distributor_id uuid default null,
  p_buyer_phone text default null,
  p_subtotal_cents integer default null,
  p_fee_cents integer default null,
  p_tax_cents integer default null,
  p_total_cents integer default null
)
returns table(
  card_id uuid,
  claim_token text,
  digital_card_number integer,
  card_index integer
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order_id uuid;
  v_qty integer;
  v_token text;
  v_number integer;
  v_card_id uuid;
  i integer;
begin
  if p_organization_id is null then
    raise exception 'organization_id is required';
  end if;

  if p_payment_intent_id is null or length(p_payment_intent_id) = 0 then
    raise exception 'payment_intent_id is required';
  end if;

  v_qty := coalesce(p_quantity, 1);

  if v_qty < 1 then
    raise exception 'quantity must be >= 1';
  end if;

  -- Idempotency: same PaymentIntent => same order & cards. Return the existing
  -- cards (ordered, with a 1-based index) without creating anything new.
  select o.id
    into v_order_id
    from public.card_orders o
   where o.stripe_payment_intent_id = p_payment_intent_id
   limit 1;

  if v_order_id is not null then
    return query
      select
        c.id,
        c.claim_token,
        c.digital_card_number,
        (row_number() over (order by c.digital_card_number))::integer
      from public.cards c
      where c.order_id = v_order_id
      order by c.digital_card_number;
    return;
  end if;

  -- Trust-boundary check (only when a distributor is named): the distributor
  -- must be a member of the organization with the distributor role.
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

  insert into public.card_orders (
    organization_id,
    distributor_id,
    stripe_payment_intent_id,
    buyer_email,
    buyer_phone,
    quantity,
    unit_price_cents,
    subtotal_cents,
    fee_cents,
    tax_cents,
    total_cents
  ) values (
    p_organization_id,
    p_distributor_id,
    p_payment_intent_id,
    p_buyer_email,
    nullif(btrim(p_buyer_phone), ''),
    v_qty,
    coalesce(p_unit_price_cents, 0),
    p_subtotal_cents,
    p_fee_cents,
    p_tax_cents,
    p_total_cents
  )
  returning id into v_order_id;

  for i in 1..v_qty loop
    v_token := replace(replace(replace(
      encode(extensions.gen_random_bytes(24), 'base64'),
      '+', '-'), '/', '_'), '=', '');

    v_number := public.next_digital_card_number(p_organization_id);

    insert into public.cards (
      organization_id,
      distributor_id,
      order_id,
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
      v_order_id,
      case when p_distributor_id is not null then now() else null end,
      'digital',
      'paid',
      v_token,
      v_number,
      p_buyer_email,
      nullif(btrim(p_buyer_phone), ''),
      now(),
      now(),
      coalesce(p_unit_price_cents, 0),
      'stripe',
      p_payment_intent_id,
      p_buyer_email
    )
    returning id into v_card_id;

    card_id := v_card_id;
    claim_token := v_token;
    digital_card_number := v_number;
    card_index := i;
    return next;
  end loop;
end;
$function$;

grant execute on function public.create_digital_card_order(
  uuid, text, text, integer, integer, uuid, text, integer, integer, integer, integer
) to authenticated, service_role;
