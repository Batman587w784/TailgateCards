/*
 * -------------------------------------------------------
 * Migration: Consolidate Platform Roles
 *
 * This migration removes the redundant platform_role column
 * from accounts and derives user roles from memberships instead.
 *
 * Single source of truth: accounts_memberships.account_role
 * -------------------------------------------------------
 */

-- ============================================================
-- Step 1: Create function to derive platform role from memberships
-- ============================================================

-- Function to get a user's highest-level role from their memberships
-- Returns the role with lowest hierarchy_level (highest priority)
-- If no special membership, returns 'cardholder'
create or replace function public.get_user_platform_role(target_user_id uuid default null)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select r.name
      from public.accounts_memberships am
      join public.roles r on r.name = am.account_role
      where am.user_id = coalesce(target_user_id, auth.uid())
      order by r.hierarchy_level asc
      limit 1
    ),
    'cardholder'
  );
$$;

comment on function public.get_user_platform_role(uuid) is
  'Derives a user''s platform role from their highest-level membership. Returns cardholder if no special membership.';

grant execute on function public.get_user_platform_role(uuid) to authenticated, service_role;

-- ============================================================
-- Step 2: Update existing get_platform_role() to use memberships
-- ============================================================

-- Replace the old function that read from the column
create or replace function public.get_platform_role()
returns public.platform_role
set search_path = ''
as $$
declare
  role_name text;
begin
  -- Get role from memberships
  role_name := public.get_user_platform_role(auth.uid());

  -- Cast to enum (will return cardholder if not a valid enum value)
  begin
    return role_name::public.platform_role;
  exception when invalid_text_representation then
    return 'cardholder'::public.platform_role;
  end;
end;
$$ language plpgsql security invoker;

-- ============================================================
-- Step 3: Update has_platform_role() to use memberships
-- ============================================================

create or replace function public.has_platform_role(target_role public.platform_role)
returns boolean
set search_path = ''
as $$
begin
  return public.get_user_platform_role(auth.uid()) = target_role::text;
end;
$$ language plpgsql security invoker;

-- ============================================================
-- Step 4: Create view for distributors (for easier querying)
-- ============================================================

create or replace view public.distributors_view as
select
  a.id,
  a.name,
  a.email,
  a.phone,
  a.is_active,
  a.created_at,
  a.organization_id,
  am.account_role
from public.accounts a
join public.accounts_memberships am on am.user_id = a.primary_owner_user_id
where a.is_personal_account = true
  and am.account_role = 'distributor';

comment on view public.distributors_view is 'View of all distributor accounts with their membership info';

grant select on public.distributors_view to authenticated, service_role;

-- ============================================================
-- Step 5: Drop the platform_role column and related index
-- ============================================================

-- Drop the index first
drop index if exists public.ix_accounts_platform_role;

-- Drop the column
alter table public.accounts drop column if exists platform_role;

-- Note: We keep the platform_role enum type for the helper functions
-- that return this type for backwards compatibility
