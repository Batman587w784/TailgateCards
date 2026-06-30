/*
 * -------------------------------------------------------
 * Migration: Tailgate Platform Roles
 *
 * This migration adds the Tailgate NFC Fundraising platform roles:
 * - Cardholder: Activates NFC cards, browses and redeems discounts
 * - Organization Admin: Oversees organization-level sales and team
 * - Distributor: Promotes and sells NFC cards on behalf of organization
 * - Merchant Owner: Validates discounts, views analytics
 * - Merchant Staff: Validates discounts at POS
 * - Super Admin: Uses existing is_super_admin() (JWT-based)
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: New Enums
-- ============================================================

-- Platform role enum for personal accounts
create type public.platform_role as enum (
  'cardholder',      -- Default role for NFC card holders
  'org_admin',       -- Organization administrator
  'distributor',     -- Sells cards on behalf of organization
  'merchant_owner',  -- Merchant business owner
  'merchant_staff'   -- Merchant staff (validates discounts)
);

comment on type public.platform_role is 'Platform-wide role assigned to each user on their personal account';

-- ============================================================
-- SECTION 2: Modify accounts table
-- ============================================================

-- Add platform_role column to accounts (personal accounts only)
alter table public.accounts
add column if not exists platform_role public.platform_role default 'cardholder';

comment on column public.accounts.platform_role is 'The platform-wide role of the user (applicable to personal accounts only)';

-- ============================================================
-- SECTION 3: Add new permissions to app_permissions enum
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

-- IMPORTANT: Commit the enum changes so they can be used in subsequent statements
-- This is required because PostgreSQL doesn't allow using new enum values in the same transaction
commit;

-- ============================================================
-- SECTION 4: Migrate existing roles to new role structure
-- ============================================================

-- IMPORTANT: We need to handle the hierarchy_level unique constraint
-- The existing roles (owner=1, member=2) conflict with new roles
-- Strategy: Delete old data first (fresh database), then insert new roles

-- Step 1: Delete existing memberships that reference old roles
-- (In a fresh database, this table is empty, but we handle existing data gracefully)
delete from public.accounts_memberships
where account_role in ('owner', 'member');

-- Step 2: Delete old role_permissions
delete from public.role_permissions
where role in ('owner', 'member');

-- Step 3: Delete old roles (now safe since no references exist)
delete from public.roles
where name in ('owner', 'member');

-- Step 4: Insert new Tailgate-specific roles
insert into public.roles (name, hierarchy_level) values
  ('org_admin', 1),       -- Organization owner (highest)
  ('distributor', 2),     -- Organization team member
  ('merchant_owner', 3),  -- Merchant owner
  ('merchant_staff', 4)   -- Merchant team member (lowest)
on conflict (name) do nothing;

-- ============================================================
-- SECTION 5: Seed role permissions
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
  ('org_admin', 'billing.manage');

-- Distributor permissions (limited org access)
insert into public.role_permissions (role, permission) values
  ('distributor', 'cards.assign'),
  ('distributor', 'sales.view');

-- Merchant Owner permissions (full merchant access)
insert into public.role_permissions (role, permission) values
  ('merchant_owner', 'merchant.manage'),
  ('merchant_owner', 'discounts.validate'),
  ('merchant_owner', 'analytics.view'),
  ('merchant_owner', 'settings.manage'),
  ('merchant_owner', 'members.manage'),
  ('merchant_owner', 'invites.manage');

-- Merchant Staff permissions (POS validation only)
insert into public.role_permissions (role, permission) values
  ('merchant_staff', 'discounts.validate');

-- ============================================================
-- SECTION 6: Create organization_profiles table
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
  -- Audit fields
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid references auth.users,
  updated_by uuid references auth.users,
  primary key (id),
  unique (account_id)
);

comment on table public.organization_profiles is 'Additional profile data for organization team accounts';
comment on column public.organization_profiles.cash_payments_enabled is 'Whether distributors can mark payments as cash (controlled by super admin)';

-- Enable RLS
alter table public.organization_profiles enable row level security;

-- Revoke all and grant specific permissions
revoke all on public.organization_profiles from authenticated, service_role;
grant select, insert, update, delete on table public.organization_profiles to authenticated, service_role;

-- Indexes
create index if not exists ix_organization_profiles_account_id on public.organization_profiles (account_id);

-- Triggers for timestamps and user tracking
create trigger organization_profiles_set_timestamps
before insert or update on public.organization_profiles
for each row execute function public.trigger_set_timestamps();

create trigger organization_profiles_set_user_tracking
before insert or update on public.organization_profiles
for each row execute function public.trigger_set_user_tracking();

-- ============================================================
-- SECTION 7: Create merchant_profiles table
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

-- Enable RLS
alter table public.merchant_profiles enable row level security;

-- Revoke all and grant specific permissions
revoke all on public.merchant_profiles from authenticated, service_role;
grant select, insert, update, delete on table public.merchant_profiles to authenticated, service_role;

-- Indexes
create index if not exists ix_merchant_profiles_account_id on public.merchant_profiles (account_id);

-- Triggers for timestamps and user tracking
create trigger merchant_profiles_set_timestamps
before insert or update on public.merchant_profiles
for each row execute function public.trigger_set_timestamps();

create trigger merchant_profiles_set_user_tracking
before insert or update on public.merchant_profiles
for each row execute function public.trigger_set_user_tracking();

-- ============================================================
-- SECTION 8: Create cardholder_profiles table
-- ============================================================

create table if not exists public.cardholder_profiles (
  id uuid unique not null default extensions.uuid_generate_v4(),
  account_id uuid references public.accounts(id) on delete cascade not null,
  -- Cardholder-specific fields from PRD
  stripe_customer_id varchar(255),  -- Stripe customer for payments
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

-- Enable RLS
alter table public.cardholder_profiles enable row level security;

-- Revoke all and grant specific permissions
revoke all on public.cardholder_profiles from authenticated, service_role;
grant select, insert, update, delete on table public.cardholder_profiles to authenticated, service_role;

-- Indexes
create index if not exists ix_cardholder_profiles_account_id on public.cardholder_profiles (account_id);

-- Triggers for timestamps and user tracking
create trigger cardholder_profiles_set_timestamps
before insert or update on public.cardholder_profiles
for each row execute function public.trigger_set_timestamps();

create trigger cardholder_profiles_set_user_tracking
before insert or update on public.cardholder_profiles
for each row execute function public.trigger_set_user_tracking();

-- ============================================================
-- SECTION 9: Helper Functions
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
  -- Verify caller has merchant_owner role on this account
  if not public.has_role_on_account(target_account_id, 'merchant_owner') then
    raise exception 'Only merchant owners can set the dashboard passcode';
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
-- SECTION 10: RLS Policies for organization_profiles
-- ============================================================

-- Super admins can view all organization profiles
create policy super_admins_access_organization_profiles
  on public.organization_profiles
  as permissive
  for select
  to authenticated
  using (public.is_super_admin());

-- Organization team members can view their own org profile
create policy organization_profiles_read
  on public.organization_profiles
  for select
  to authenticated
  using (
    public.has_role_on_account(account_id)
  );

-- Only org_admin can insert organization profile
create policy organization_profiles_insert
  on public.organization_profiles
  for insert
  to authenticated
  with check (
    public.has_role_on_account(account_id, 'org_admin')
  );

-- Only org_admin can update organization profile
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

-- Only org_admin can delete organization profile
create policy organization_profiles_delete
  on public.organization_profiles
  for delete
  to authenticated
  using (
    public.has_role_on_account(account_id, 'org_admin')
  );

-- ============================================================
-- SECTION 11: RLS Policies for merchant_profiles
-- ============================================================

-- Super admins can view all merchant profiles
create policy super_admins_access_merchant_profiles
  on public.merchant_profiles
  as permissive
  for select
  to authenticated
  using (public.is_super_admin());

-- Merchant team members can view their own merchant profile
create policy merchant_profiles_read
  on public.merchant_profiles
  for select
  to authenticated
  using (
    public.has_role_on_account(account_id)
  );

-- Only merchant_owner can insert merchant profile
create policy merchant_profiles_insert
  on public.merchant_profiles
  for insert
  to authenticated
  with check (
    public.has_role_on_account(account_id, 'merchant_owner')
  );

-- Only merchant_owner can update merchant profile
create policy merchant_profiles_update
  on public.merchant_profiles
  for update
  to authenticated
  using (
    public.has_role_on_account(account_id, 'merchant_owner')
  )
  with check (
    public.has_role_on_account(account_id, 'merchant_owner')
  );

-- Only merchant_owner can delete merchant profile
create policy merchant_profiles_delete
  on public.merchant_profiles
  for delete
  to authenticated
  using (
    public.has_role_on_account(account_id, 'merchant_owner')
  );

-- ============================================================
-- SECTION 12: RLS Policies for cardholder_profiles
-- ============================================================

-- Super admins can view all cardholder profiles
create policy super_admins_access_cardholder_profiles
  on public.cardholder_profiles
  as permissive
  for select
  to authenticated
  using (public.is_super_admin());

-- Users can only view their own cardholder profile (via personal account)
-- Uses helper function for better performance
create policy cardholder_profiles_read
  on public.cardholder_profiles
  for select
  to authenticated
  using (
    account_id = public.get_user_personal_account_id()
  );

-- Users can insert their own cardholder profile
create policy cardholder_profiles_insert
  on public.cardholder_profiles
  for insert
  to authenticated
  with check (
    account_id = public.get_user_personal_account_id()
  );

-- Users can update their own cardholder profile
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

-- Users can delete their own cardholder profile
create policy cardholder_profiles_delete
  on public.cardholder_profiles
  for delete
  to authenticated
  using (
    account_id = public.get_user_personal_account_id()
  );

-- ============================================================
-- SECTION 13: Additional Indexes for Performance
-- ============================================================

-- Index for platform_role lookups on personal accounts
create index if not exists ix_accounts_platform_role
  on public.accounts (platform_role)
  where is_personal_account = true;

-- Index for Stripe account ID lookups (payment processing)
create index if not exists ix_merchant_profiles_stripe_account_id
  on public.merchant_profiles (stripe_account_id)
  where stripe_account_id is not null;

-- Index for Stripe customer ID lookups (payment processing)
create index if not exists ix_cardholder_profiles_stripe_customer_id
  on public.cardholder_profiles (stripe_customer_id)
  where stripe_customer_id is not null;
