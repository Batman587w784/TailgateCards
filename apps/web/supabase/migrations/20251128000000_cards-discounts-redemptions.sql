/*
 * -------------------------------------------------------
 * Migration: Cards, Discounts, and Redemptions
 *
 * This migration adds the core tables for the Tailgate NFC platform:
 * - cards: NFC cards with TG-XXXX codes, status, and expiration
 * - discounts: Merchant offers with validity periods
 * - redemptions: Usage tracking with value snapshots
 *
 * Also adds optional location fields to merchant_profiles for distance calculations.
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: New Enums
-- ============================================================

-- Card status enum
create type public.card_status as enum (
  'pending',     -- Card created but not yet activated
  'activated',   -- Card is active and can be used
  'expired',     -- Card has passed its expiration date
  'cancelled'    -- Card was manually cancelled
);

comment on type public.card_status is 'Status lifecycle for NFC cards';

-- Payment type enum
create type public.payment_type as enum (
  'stripe',      -- Paid via Stripe
  'cash'         -- Paid with cash (marked by distributor)
);

comment on type public.payment_type is 'Payment method for card purchases';

-- Discount type enum
create type public.discount_type as enum (
  'percentage',    -- e.g., 20% off
  'fixed_amount'   -- e.g., $5 off
);

comment on type public.discount_type is 'Type of discount value';

-- Redemption status enum
create type public.redemption_status as enum (
  'completed',   -- Redemption successful
  'refunded'     -- Redemption was refunded
);

comment on type public.redemption_status is 'Status of a discount redemption';

-- ============================================================
-- SECTION 2: Add location fields to merchant_profiles
-- ============================================================

alter table public.merchant_profiles
  add column if not exists latitude decimal(10, 8),
  add column if not exists longitude decimal(11, 8);

comment on column public.merchant_profiles.latitude is 'Merchant location latitude for distance calculations (optional)';
comment on column public.merchant_profiles.longitude is 'Merchant location longitude for distance calculations (optional)';

-- Index for geospatial queries (only where location is set)
create index if not exists ix_merchant_profiles_location
  on public.merchant_profiles (latitude, longitude)
  where latitude is not null and longitude is not null;

-- ============================================================
-- SECTION 3: Create cards table
-- ============================================================

create table if not exists public.cards (
  id uuid unique not null default extensions.uuid_generate_v4(),

  -- Card identification
  card_code varchar(20) not null,

  -- Status
  status public.card_status not null default 'pending',

  -- Relationships
  organization_id uuid not null references public.accounts(id) on delete restrict,
  distributor_id uuid references public.accounts(id) on delete set null,
  cardholder_id uuid references public.accounts(id) on delete set null,

  -- Financial
  price_cents integer not null default 0,
  payment_type public.payment_type not null default 'stripe',
  stripe_payment_intent_id varchar(255),

  -- Dates
  activated_at timestamptz,
  expires_at timestamptz,

  -- Audit fields
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid references auth.users,
  updated_by uuid references auth.users,

  primary key (id),
  unique (card_code)
);

comment on table public.cards is 'NFC cards sold by organizations through distributors';
comment on column public.cards.card_code is 'Unique card code in format TG-YYYY-XXXXXX';
comment on column public.cards.organization_id is 'Organization that sold this card';
comment on column public.cards.distributor_id is 'Distributor who sold this card';
comment on column public.cards.cardholder_id is 'Cardholder who owns this card (set on activation)';
comment on column public.cards.price_cents is 'Price paid for the card in cents';
comment on column public.cards.expires_at is 'When the card expires (usually 1 year from activation)';

-- Enable RLS
alter table public.cards enable row level security;

-- Revoke all and grant specific permissions
revoke all on public.cards from authenticated, service_role;
grant select, insert, update, delete on table public.cards to authenticated, service_role;

-- Indexes
create index if not exists ix_cards_card_code on public.cards (card_code);
create index if not exists ix_cards_cardholder_id on public.cards (cardholder_id) where cardholder_id is not null;
create index if not exists ix_cards_organization_id on public.cards (organization_id);
create index if not exists ix_cards_distributor_id on public.cards (distributor_id) where distributor_id is not null;
create index if not exists ix_cards_status on public.cards (status);
create index if not exists ix_cards_expires_at on public.cards (expires_at) where expires_at is not null;

-- Triggers for timestamps and user tracking
create trigger cards_set_timestamps
before insert or update on public.cards
for each row execute function public.trigger_set_timestamps();

create trigger cards_set_user_tracking
before insert or update on public.cards
for each row execute function public.trigger_set_user_tracking();

-- ============================================================
-- SECTION 4: Create discounts table
-- ============================================================

create table if not exists public.discounts (
  id uuid unique not null default extensions.uuid_generate_v4(),

  -- Owner (merchant is required)
  merchant_id uuid not null references public.accounts(id) on delete cascade,

  -- Content
  title varchar(255) not null,
  description text,
  terms text,

  -- Discount value
  discount_type public.discount_type not null default 'percentage',
  discount_value decimal(10,2) not null,

  -- Validity
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  max_redemptions_per_card integer default 1,

  -- Organization
  category varchar(100),
  tags text[],
  is_active boolean not null default true,

  -- Audit fields
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid references auth.users,
  updated_by uuid references auth.users,

  primary key (id),

  -- Constraints
  constraint discounts_value_positive check (discount_value > 0),
  constraint discounts_percentage_range check (
    discount_type != 'percentage' or (discount_value >= 0 and discount_value <= 100)
  ),
  constraint discounts_valid_dates check (
    valid_until is null or valid_until > valid_from
  ),
  constraint discounts_max_redemptions_positive check (
    max_redemptions_per_card is null or max_redemptions_per_card > 0
  )
);

comment on table public.discounts is 'Merchant discount offers that cardholders can redeem';
comment on column public.discounts.merchant_id is 'Merchant offering this discount';
comment on column public.discounts.discount_type is 'Whether discount is percentage or fixed amount';
comment on column public.discounts.discount_value is 'Discount value (percentage 0-100 or dollar amount)';
comment on column public.discounts.max_redemptions_per_card is 'Maximum times this discount can be redeemed per card';

-- Enable RLS
alter table public.discounts enable row level security;

-- Revoke all and grant specific permissions
revoke all on public.discounts from authenticated, service_role;
grant select, insert, update, delete on table public.discounts to authenticated, service_role;

-- Indexes
create index if not exists ix_discounts_merchant_id on public.discounts (merchant_id);
create index if not exists ix_discounts_is_active on public.discounts (is_active) where is_active = true;
create index if not exists ix_discounts_valid_dates on public.discounts (valid_from, valid_until);
create index if not exists ix_discounts_category on public.discounts (category) where category is not null;
create index if not exists ix_discounts_tags on public.discounts using gin (tags) where tags is not null;

-- Triggers for timestamps and user tracking
create trigger discounts_set_timestamps
before insert or update on public.discounts
for each row execute function public.trigger_set_timestamps();

create trigger discounts_set_user_tracking
before insert or update on public.discounts
for each row execute function public.trigger_set_user_tracking();

-- ============================================================
-- SECTION 5: Create redemptions table
-- ============================================================

create table if not exists public.redemptions (
  id uuid unique not null default extensions.uuid_generate_v4(),

  -- Relationships
  card_id uuid not null references public.cards(id) on delete restrict,
  discount_id uuid not null references public.discounts(id) on delete restrict,
  merchant_id uuid not null references public.accounts(id) on delete restrict,
  validated_by uuid references auth.users,

  -- Snapshot (preserved for history even if discount changes)
  discount_value_snapshot decimal(10,2) not null,
  discount_type_snapshot public.discount_type not null,

  -- Status
  status public.redemption_status not null default 'completed',
  refunded_at timestamptz,
  refund_reason text,

  -- Timestamps
  redeemed_at timestamptz not null default now(),

  -- Audit fields
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid references auth.users,
  updated_by uuid references auth.users,

  primary key (id),

  -- Constraints
  constraint redemptions_refund_consistency check (
    (status = 'refunded' and refunded_at is not null) or
    (status = 'completed' and refunded_at is null)
  )
);

comment on table public.redemptions is 'Records of discount redemptions by cardholders';
comment on column public.redemptions.validated_by is 'Merchant staff who validated this redemption';
comment on column public.redemptions.discount_value_snapshot is 'Discount value at time of redemption (for historical accuracy)';
comment on column public.redemptions.discount_type_snapshot is 'Discount type at time of redemption (for historical accuracy)';

-- Enable RLS
alter table public.redemptions enable row level security;

-- Revoke all and grant specific permissions
revoke all on public.redemptions from authenticated, service_role;
grant select, insert, update, delete on table public.redemptions to authenticated, service_role;

-- Indexes
create index if not exists ix_redemptions_card_id on public.redemptions (card_id);
create index if not exists ix_redemptions_discount_id on public.redemptions (discount_id);
create index if not exists ix_redemptions_merchant_id on public.redemptions (merchant_id);
create index if not exists ix_redemptions_redeemed_at on public.redemptions (redeemed_at desc);
create index if not exists ix_redemptions_status on public.redemptions (status);
-- Composite index for checking redemption limits per card+discount
create index if not exists ix_redemptions_card_discount on public.redemptions (card_id, discount_id) where status = 'completed';

-- Triggers for timestamps and user tracking
create trigger redemptions_set_timestamps
before insert or update on public.redemptions
for each row execute function public.trigger_set_timestamps();

create trigger redemptions_set_user_tracking
before insert or update on public.redemptions
for each row execute function public.trigger_set_user_tracking();

-- ============================================================
-- SECTION 6: RLS Policies for cards
-- ============================================================

-- Super admins can access all cards
create policy super_admins_access_cards
  on public.cards
  as permissive
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Cardholders can view their own cards
create policy cards_cardholder_read
  on public.cards
  for select
  to authenticated
  using (
    cardholder_id = public.get_user_personal_account_id()
  );

-- Organization members can view cards sold by their organization
create policy cards_organization_read
  on public.cards
  for select
  to authenticated
  using (
    public.has_role_on_account(organization_id)
  );

-- Distributors can view cards they sold
create policy cards_distributor_read
  on public.cards
  for select
  to authenticated
  using (
    distributor_id = public.get_user_personal_account_id()
  );

-- Organization admins and distributors can create cards
create policy cards_organization_insert
  on public.cards
  for insert
  to authenticated
  with check (
    public.has_role_on_account(organization_id, 'org_admin') or
    public.has_role_on_account(organization_id, 'distributor')
  );

-- Organization admins can update cards
create policy cards_organization_update
  on public.cards
  for update
  to authenticated
  using (
    public.has_role_on_account(organization_id, 'org_admin')
  )
  with check (
    public.has_role_on_account(organization_id, 'org_admin')
  );

-- ============================================================
-- SECTION 7: RLS Policies for discounts
-- ============================================================

-- Super admins can access all discounts
create policy super_admins_access_discounts
  on public.discounts
  as permissive
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Anyone authenticated can view active discounts (for browsing)
create policy discounts_public_read
  on public.discounts
  for select
  to authenticated
  using (
    is_active = true and
    valid_from <= now() and
    (valid_until is null or valid_until > now())
  );

-- Merchants can view all their own discounts (including inactive)
create policy discounts_merchant_read
  on public.discounts
  for select
  to authenticated
  using (
    public.has_role_on_account(merchant_id)
  );

-- Merchant owners can create discounts
create policy discounts_merchant_insert
  on public.discounts
  for insert
  to authenticated
  with check (
    public.has_role_on_account(merchant_id, 'merchant_owner')
  );

-- Merchant owners can update their discounts
create policy discounts_merchant_update
  on public.discounts
  for update
  to authenticated
  using (
    public.has_role_on_account(merchant_id, 'merchant_owner')
  )
  with check (
    public.has_role_on_account(merchant_id, 'merchant_owner')
  );

-- Merchant owners can delete their discounts
create policy discounts_merchant_delete
  on public.discounts
  for delete
  to authenticated
  using (
    public.has_role_on_account(merchant_id, 'merchant_owner')
  );

-- ============================================================
-- SECTION 8: RLS Policies for redemptions
-- ============================================================

-- Super admins can access all redemptions
create policy super_admins_access_redemptions
  on public.redemptions
  as permissive
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Cardholders can view their own redemptions
create policy redemptions_cardholder_read
  on public.redemptions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.cards c
      where c.id = card_id
        and c.cardholder_id = public.get_user_personal_account_id()
    )
  );

-- Merchants can view redemptions at their business
create policy redemptions_merchant_read
  on public.redemptions
  for select
  to authenticated
  using (
    public.has_role_on_account(merchant_id)
  );

-- Merchant staff can create redemptions (validate discounts)
create policy redemptions_merchant_insert
  on public.redemptions
  for insert
  to authenticated
  with check (
    public.has_role_on_account(merchant_id, 'merchant_owner') or
    public.has_role_on_account(merchant_id, 'merchant_staff')
  );

-- Merchant owners can update redemptions (for refunds)
create policy redemptions_merchant_update
  on public.redemptions
  for update
  to authenticated
  using (
    public.has_role_on_account(merchant_id, 'merchant_owner')
  )
  with check (
    public.has_role_on_account(merchant_id, 'merchant_owner')
  );

-- ============================================================
-- SECTION 9: Helper function to generate card codes
-- ============================================================

create or replace function public.generate_card_code()
returns varchar(20)
language plpgsql
set search_path = ''
as $$
declare
  year_part varchar(4);
  random_part varchar(7);
  new_code varchar(20);
  exists_count integer;
begin
  year_part := to_char(current_date, 'YYYY');

  loop
    -- Generate random 7-digit number
    random_part := lpad(floor(random() * 10000000)::text, 7, '0');
    new_code := 'TG-' || year_part || '-' || random_part;

    -- Check if code already exists
    select count(*) into exists_count from public.cards where card_code = new_code;

    if exists_count = 0 then
      return new_code;
    end if;
  end loop;
end;
$$;

comment on function public.generate_card_code() is 'Generates a unique card code in format TG-YYYY-XXXXXXX';

grant execute on function public.generate_card_code() to authenticated, service_role;

-- ============================================================
-- SECTION 10: Safe card activation function
-- ============================================================

create or replace function public.activate_card(
  p_card_code varchar(20),
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
  -- Get user's personal account ID
  v_user_account_id := public.get_user_personal_account_id();

  if v_user_account_id is null then
    raise exception 'User must be authenticated';
  end if;

  -- Find and lock the card
  select * into v_card
  from public.cards
  where card_code = p_card_code
  for update;

  if v_card is null then
    raise exception 'Card not found';
  end if;

  if v_card.status != 'pending' then
    raise exception 'Card cannot be activated (status: %)', v_card.status;
  end if;

  if v_card.cardholder_id is not null then
    raise exception 'Card is already assigned to another user';
  end if;

  -- Activate the card with controlled field updates only
  update public.cards
  set
    cardholder_id = v_user_account_id,
    status = 'activated',
    activated_at = now(),
    expires_at = now() + (p_validity_days || ' days')::interval
  where id = v_card.id
  returning * into v_card;

  return v_card;
end;
$$;

comment on function public.activate_card(varchar, integer) is 'Safely activates a pending card for the current user';

grant execute on function public.activate_card(varchar, integer) to authenticated;

-- ============================================================
-- SECTION 11: Redemption validation trigger
-- ============================================================

create or replace function public.validate_redemption_merchant()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_discount_merchant_id uuid;
begin
  -- Get the merchant_id from the discount
  select merchant_id into v_discount_merchant_id
  from public.discounts
  where id = new.discount_id;

  if v_discount_merchant_id is null then
    raise exception 'Discount not found';
  end if;

  -- Ensure redemption merchant matches discount merchant
  if new.merchant_id != v_discount_merchant_id then
    raise exception 'Redemption merchant must match discount merchant';
  end if;

  return new;
end;
$$;

comment on function public.validate_redemption_merchant() is 'Validates that redemption merchant matches discount merchant';

-- Trigger to validate on insert
create trigger redemptions_validate_merchant
before insert on public.redemptions
for each row execute function public.validate_redemption_merchant();
