/*
 * -------------------------------------------------------
 * Section: Tailgate Platform Roles
 *
 * This schema defines the Tailgate NFC Fundraising platform roles:
 * - Cardholder: Activates NFC cards, browses and redeems discounts
 * - Organization Admin: Oversees organization-level sales and team
 * - Distributor: Promotes and sells NFC cards on behalf of organization
 * - Merchant: Validates discounts, views analytics (passcode-protected)
 * - Super Admin: Uses existing is_super_admin() (JWT-based)
 *
 * Architecture:
 * - platform_role enum on personal accounts identifies user's platform-wide role
 * - Organizations and Merchants are team accounts with profile tables
 * - org_admin/distributor roles for organization team memberships
 * - merchant role for merchant team memberships
 * -------------------------------------------------------
 */

-- ============================================================
-- Platform Role Enum
-- ============================================================

create type public.platform_role as enum (
  'cardholder',      -- Default role for NFC card holders
  'org_admin',       -- Organization administrator
  'distributor',     -- Sells cards on behalf of organization
  'merchant'         -- Merchant user (validates discounts, analytics via passcode)
);

comment on type public.platform_role is 'Platform-wide role assigned to each user on their personal account';

-- Add platform_role column to accounts (personal accounts only)
alter table public.accounts
add column if not exists platform_role public.platform_role default 'cardholder';

comment on column public.accounts.platform_role is 'The platform-wide role of the user (applicable to personal accounts only)';

-- ============================================================
-- New Permissions
-- ============================================================

-- Organization permissions
alter type public.app_permissions add value if not exists 'org.manage';
alter type public.app_permissions add value if not exists 'distributors.manage';
alter type public.app_permissions add value if not exists 'cards.assign';
alter type public.app_permissions add value if not exists 'sales.view';

-- Merchant permissions
alter type public.app_permissions add value if not exists 'merchant.manage';
alter type public.app_permissions add value if not exists 'discounts.validate';
alter type public.app_permissions add value if not exists 'analytics.view';

-- Cardholder permissions
alter type public.app_permissions add value if not exists 'cards.activate';
alter type public.app_permissions add value if not exists 'discounts.redeem';

-- ============================================================
-- Tailgate Roles (replace owner/member)
-- ============================================================

-- NOTE: In migration, old roles are deleted first
-- This schema file shows the final state

insert into public.roles (name, hierarchy_level) values
  ('org_admin', 1),       -- Organization owner (highest)
  ('distributor', 2),     -- Organization team member
  ('merchant', 3)         -- Merchant user
on conflict (name) do nothing;

-- ============================================================
-- Role Permissions
-- ============================================================

-- Organization Admin permissions (full org access)
insert into public.role_permissions (role, permission) values
  ('org_admin', 'org.manage'),
  ('org_admin', 'distributors.manage'),
  ('org_admin', 'cards.assign'),
  ('org_admin', 'sales.view'),
  ('org_admin', 'settings.manage'),
  ('org_admin', 'members.manage'),
  ('org_admin', 'invites.manage'),
  ('org_admin', 'billing.manage')
on conflict (role, permission) do nothing;

-- Distributor permissions (limited org access)
insert into public.role_permissions (role, permission) values
  ('distributor', 'cards.assign'),
  ('distributor', 'sales.view')
on conflict (role, permission) do nothing;

-- Merchant permissions (all merchant access - analytics via passcode)
insert into public.role_permissions (role, permission) values
  ('merchant', 'merchant.manage'),
  ('merchant', 'discounts.validate'),
  ('merchant', 'analytics.view'),
  ('merchant', 'settings.manage'),
  ('merchant', 'members.manage'),
  ('merchant', 'invites.manage')
on conflict (role, permission) do nothing;

-- ============================================================
-- Organization Profiles Table
-- ============================================================

create table if not exists public.organization_profiles (
  id uuid unique not null default extensions.uuid_generate_v4(),
  account_id uuid references public.accounts(id) on delete cascade not null,
  -- Organization-specific fields
  organization_name varchar(255),
  organization_type varchar(100),  -- e.g., 'sports_team', 'charity', 'school'
  contact_phone varchar(50),
  address text,
  cash_payments_enabled boolean default false not null,
  card_price_cents integer not null default 2500,  -- Price of cards for this org (default $25.00)
  share_per_card_cents integer not null default 1250,  -- Organization share per card sale (default $12.50)
  -- Audit fields
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid references auth.users,
  updated_by uuid references auth.users,
  primary key (id),
  unique (account_id),
  constraint organization_profiles_share_lte_price
    check (share_per_card_cents <= card_price_cents)
);

comment on table public.organization_profiles is 'Additional profile data for organization team accounts';
comment on column public.organization_profiles.cash_payments_enabled is 'Whether distributors can mark payments as cash (controlled by super admin)';

alter table public.organization_profiles enable row level security;

revoke all on public.organization_profiles from authenticated, service_role;
grant select, insert, update, delete on table public.organization_profiles to authenticated, service_role;

create index if not exists ix_organization_profiles_account_id on public.organization_profiles (account_id);

create trigger organization_profiles_set_timestamps
before insert or update on public.organization_profiles
for each row execute function public.trigger_set_timestamps();

create trigger organization_profiles_set_user_tracking
before insert or update on public.organization_profiles
for each row execute function public.trigger_set_user_tracking();

-- ============================================================
-- Merchant Profiles Table
-- ============================================================

create table if not exists public.merchant_profiles (
  id uuid unique not null default extensions.uuid_generate_v4(),
  account_id uuid references public.accounts(id) on delete cascade not null,
  -- Merchant-specific fields
  business_name varchar(255),
  business_type varchar(100),  -- e.g., 'restaurant', 'retail', 'service'
  contact_phone varchar(50),
  address text,
  dashboard_passcode_hash text,  -- Bcrypt hash of passcode for analytics access (PRD requirement)
  stripe_account_id varchar(255),   -- For payment processing
  -- Audit fields
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid references auth.users,
  updated_by uuid references auth.users,
  primary key (id),
  unique (account_id)
);

comment on table public.merchant_profiles is 'Additional profile data for merchant team accounts. WARNING: Deletes cascade when parent account is deleted.';
comment on column public.merchant_profiles.dashboard_passcode_hash is 'Bcrypt hash of passcode required for staff to access analytics dashboard';

alter table public.merchant_profiles enable row level security;

revoke all on public.merchant_profiles from authenticated, service_role;
grant select, insert, update, delete on table public.merchant_profiles to authenticated, service_role;

create index if not exists ix_merchant_profiles_account_id on public.merchant_profiles (account_id);

create trigger merchant_profiles_set_timestamps
before insert or update on public.merchant_profiles
for each row execute function public.trigger_set_timestamps();

create trigger merchant_profiles_set_user_tracking
before insert or update on public.merchant_profiles
for each row execute function public.trigger_set_user_tracking();

-- ============================================================
-- Cardholder Profiles Table
-- ============================================================

create table if not exists public.cardholder_profiles (
  id uuid unique not null default extensions.uuid_generate_v4(),
  account_id uuid references public.accounts(id) on delete cascade not null,
  -- Cardholder-specific fields from PRD
  stripe_customer_id varchar(255),  -- Stripe customer for payments
  -- Wallet integration tracking (optimistic; no platform callback exists)
  apple_wallet_added_at timestamptz,
  google_wallet_added_at timestamptz,
  -- Audit fields
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid references auth.users,
  updated_by uuid references auth.users,
  primary key (id),
  unique (account_id)
);

comment on table public.cardholder_profiles is 'Additional profile data for cardholder personal accounts';
comment on column public.cardholder_profiles.stripe_customer_id is 'Stripe customer ID for payment processing';
comment on column public.cardholder_profiles.apple_wallet_added_at is 'When the cardholder added their card to Apple Wallet (optimistic; set on button click — no platform callback exists)';
comment on column public.cardholder_profiles.google_wallet_added_at is 'When the cardholder added their card to Google Wallet (optimistic; set on button click — no platform callback exists)';

alter table public.cardholder_profiles enable row level security;

revoke all on public.cardholder_profiles from authenticated, service_role;
grant select, insert, update, delete on table public.cardholder_profiles to authenticated, service_role;

create index if not exists ix_cardholder_profiles_account_id on public.cardholder_profiles (account_id);

create trigger cardholder_profiles_set_timestamps
before insert or update on public.cardholder_profiles
for each row execute function public.trigger_set_timestamps();

create trigger cardholder_profiles_set_user_tracking
before insert or update on public.cardholder_profiles
for each row execute function public.trigger_set_user_tracking();

-- ============================================================
-- Helper Functions
-- ============================================================

-- Function to get the current user's platform role
create or replace function public.get_platform_role()
returns public.platform_role
set search_path = ''
as $$
declare
  role public.platform_role;
begin
  select platform_role into role
  from public.accounts
  where primary_owner_user_id = auth.uid()
    and is_personal_account = true;

  return coalesce(role, 'cardholder'::public.platform_role);
end;
$$ language plpgsql security invoker;

grant execute on function public.get_platform_role() to authenticated;

-- Function to check if current user has a specific platform role
create or replace function public.has_platform_role(target_role public.platform_role)
returns boolean
set search_path = ''
as $$
begin
  return exists(
    select 1
    from public.accounts
    where primary_owner_user_id = auth.uid()
      and is_personal_account = true
      and platform_role = target_role
  );
end;
$$ language plpgsql security invoker;

grant execute on function public.has_platform_role(public.platform_role) to authenticated;

-- Function to check if an account is an organization (has organization_profiles)
create or replace function public.is_organization(target_account_id uuid)
returns boolean
set search_path = ''
as $$
begin
  return exists(
    select 1
    from public.organization_profiles
    where account_id = target_account_id
  );
end;
$$ language plpgsql security invoker;

grant execute on function public.is_organization(uuid) to authenticated, service_role;

-- Function to check if an account is a merchant (has merchant_profiles)
create or replace function public.is_merchant(target_account_id uuid)
returns boolean
set search_path = ''
as $$
begin
  return exists(
    select 1
    from public.merchant_profiles
    where account_id = target_account_id
  );
end;
$$ language plpgsql security invoker;

grant execute on function public.is_merchant(uuid) to authenticated, service_role;

-- Function to get current user's personal account ID (for efficient RLS policies)
create or replace function public.get_user_personal_account_id()
returns uuid
set search_path = ''
as $$
  select id from public.accounts
  where primary_owner_user_id = auth.uid()
    and is_personal_account = true
  limit 1;
$$ language sql stable security invoker;

grant execute on function public.get_user_personal_account_id() to authenticated;

-- Function to set merchant dashboard passcode (hashes the passcode)
create or replace function public.set_merchant_dashboard_passcode(
  target_account_id uuid,
  passcode text
)
returns void
set search_path = ''
as $$
begin
  -- Verify caller has merchant role on this account
  if not public.has_role_on_account(target_account_id, 'merchant') then
    raise exception 'Only merchants can set the dashboard passcode';
  end if;

  update public.merchant_profiles
  set dashboard_passcode_hash = extensions.crypt(passcode, extensions.gen_salt('bf'))
  where account_id = target_account_id;
end;
$$ language plpgsql security invoker;

grant execute on function public.set_merchant_dashboard_passcode(uuid, text) to authenticated;

-- Function to verify merchant dashboard passcode
create or replace function public.verify_merchant_dashboard_passcode(
  target_account_id uuid,
  passcode text
)
returns boolean
set search_path = ''
as $$
declare
  stored_hash text;
begin
  -- Verify caller has a role on this merchant account
  if not public.has_role_on_account(target_account_id) then
    return false;
  end if;

  select dashboard_passcode_hash into stored_hash
  from public.merchant_profiles
  where account_id = target_account_id;

  if stored_hash is null then
    return false;
  end if;

  return stored_hash = extensions.crypt(passcode, stored_hash);
end;
$$ language plpgsql security invoker;

grant execute on function public.verify_merchant_dashboard_passcode(uuid, text) to authenticated;

-- ============================================================
-- RLS Policies: organization_profiles
-- ============================================================

create policy super_admins_access_organization_profiles
  on public.organization_profiles
  as permissive
  for select
  to authenticated
  using (public.is_super_admin());

create policy organization_profiles_read
  on public.organization_profiles
  for select
  to authenticated
  using (
    public.has_role_on_account(account_id)
  );

create policy organization_profiles_insert
  on public.organization_profiles
  for insert
  to authenticated
  with check (
    public.has_role_on_account(account_id, 'org_admin')
  );

create policy organization_profiles_update
  on public.organization_profiles
  for update
  to authenticated
  using (
    public.has_role_on_account(account_id, 'org_admin')
  )
  with check (
    public.has_role_on_account(account_id, 'org_admin')
  );

create policy organization_profiles_delete
  on public.organization_profiles
  for delete
  to authenticated
  using (
    public.has_role_on_account(account_id, 'org_admin')
  );

-- ============================================================
-- RLS Policies: merchant_profiles
-- ============================================================

create policy super_admins_access_merchant_profiles
  on public.merchant_profiles
  as permissive
  for select
  to authenticated
  using (public.is_super_admin());

create policy merchant_profiles_read
  on public.merchant_profiles
  for select
  to authenticated
  using (
    public.has_role_on_account(account_id)
  );

-- Allow public read access to merchant profiles (basic business info)
-- Merchant business name, address, etc. are public-facing information
-- needed when displaying discounts to cardholders.
create policy merchant_profiles_public_read
  on public.merchant_profiles
  for select
  to authenticated
  using (true);

create policy merchant_profiles_insert
  on public.merchant_profiles
  for insert
  to authenticated
  with check (
    public.has_role_on_account(account_id, 'merchant')
  );

create policy merchant_profiles_update
  on public.merchant_profiles
  for update
  to authenticated
  using (
    public.has_role_on_account(account_id, 'merchant')
  )
  with check (
    public.has_role_on_account(account_id, 'merchant')
  );

create policy merchant_profiles_delete
  on public.merchant_profiles
  for delete
  to authenticated
  using (
    public.has_role_on_account(account_id, 'merchant')
  );

-- ============================================================
-- RLS Policies: cardholder_profiles
-- ============================================================

create policy super_admins_access_cardholder_profiles
  on public.cardholder_profiles
  as permissive
  for select
  to authenticated
  using (public.is_super_admin());

-- Uses helper function for better performance
create policy cardholder_profiles_read
  on public.cardholder_profiles
  for select
  to authenticated
  using (
    account_id = public.get_user_personal_account_id()
  );

create policy cardholder_profiles_insert
  on public.cardholder_profiles
  for insert
  to authenticated
  with check (
    account_id = public.get_user_personal_account_id()
  );

create policy cardholder_profiles_update
  on public.cardholder_profiles
  for update
  to authenticated
  using (
    account_id = public.get_user_personal_account_id()
  )
  with check (
    account_id = public.get_user_personal_account_id()
  );

create policy cardholder_profiles_delete
  on public.cardholder_profiles
  for delete
  to authenticated
  using (
    account_id = public.get_user_personal_account_id()
  );

-- ============================================================
-- Security Definer Helpers for Account Policies
-- (Break circular RLS evaluation that causes stack depth errors)
-- ============================================================

-- Check if an account has a merchant_profiles row (bypasses RLS)
-- Safe: merchant_profiles already has a USING (true) public read policy
create or replace function public.is_merchant_account(target_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.merchant_profiles where account_id = target_id
  );
$$;

grant execute on function public.is_merchant_account(uuid) to authenticated;

-- Check if user has a card from an organization (bypasses RLS)
-- Safe: scoped to current user via get_user_personal_account_id()
create or replace function public.is_card_organization(target_org_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cards
    where cardholder_id = public.get_user_personal_account_id()
      and organization_id = target_org_id
  );
$$;

grant execute on function public.is_card_organization(uuid) to authenticated;

-- Check if target account is the cardholder of a card in an org the caller
-- administers (bypasses RLS). Used to let org_admins see cardholder names
-- on dashboards (Recent Activations, etc.).
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

-- ============================================================
-- RLS Policies: accounts (tailgate-specific)
-- ============================================================

-- Allow cardholders to see merchant account pictures (logos) when viewing discounts
create policy accounts_merchant_public_picture_read
  on public.accounts
  for select
  to authenticated
  using (public.is_merchant_account(id));

-- Allow cardholders to view organization accounts that issued their cards
create policy accounts_cardholder_view_org
  on public.accounts
  for select
  to authenticated
  using (public.is_card_organization(id));

-- Allow org_admins to view cardholder accounts linked to cards their org owns.
-- Needed so dashboards (Recent Activations) can resolve cardholder.name.
create policy accounts_org_admin_view_cardholders
  on public.accounts
  for select
  to authenticated
  using (public.is_cardholder_in_my_orgs(id));
