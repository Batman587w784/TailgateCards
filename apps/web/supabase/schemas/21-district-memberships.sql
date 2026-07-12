/*
 * -------------------------------------------------------
 * Section: District memberships + district_admin role (M1 / T2)
 *
 * Adds the `district_admin` platform role, scoped to ONE district via a
 * dedicated `district_memberships` join table (locked recommendation from the
 * M1 spec §3.5 — cleanest RLS, consistent with the membership model).
 *
 * DESIGN NOTE (divergence from the ticket text, deliberate):
 *   The ticket says "extend the roles table (hierarchy_level 0)". That is NOT
 *   possible as written: public.roles has `check (hierarchy_level > 0)` and
 *   `unique(hierarchy_level)`, and roles rows are only reachable through
 *   accounts_memberships (which reference *accounts*, not districts). So a
 *   district_admin is NOT a roles-table row. Instead:
 *     - 'district_admin' is added to the platform_role ENUM (schema 18 + a
 *       dedicated ALTER TYPE migration), and
 *     - get_user_platform_role() resolves it from district_memberships,
 *       ranking it ABOVE every org role.
 *   Assignment is super-admin only (via the service-role admin client).
 * -------------------------------------------------------
 */

-- ============================================================
-- district_memberships table
-- ============================================================

create table if not exists public.district_memberships (
  district_id uuid references public.districts(id) on delete cascade not null,
  -- The district admin's PERSONAL account (accounts.id, is_personal_account).
  account_id uuid references public.accounts(id) on delete cascade not null,
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid references auth.users,
  updated_by uuid references auth.users,
  primary key (district_id, account_id)
);

comment on table public.district_memberships is 'Assigns a personal account as admin of a district (campus). Assignment is super-admin only. A user with any row here resolves to platform role district_admin.';

alter table public.district_memberships enable row level security;

revoke all on public.district_memberships from anon, authenticated, service_role;
grant select on public.district_memberships to authenticated;
-- Assignment/removal is super-admin only, performed via the service-role admin
-- client (service_role bypasses RLS). No authenticated DML policy on purpose.
grant select, insert, update, delete on public.district_memberships to service_role;

create index if not exists ix_district_memberships_account_id on public.district_memberships (account_id);

create trigger district_memberships_set_timestamps
before insert or update on public.district_memberships
for each row execute function public.trigger_set_timestamps();

create trigger district_memberships_set_user_tracking
before insert or update on public.district_memberships
for each row execute function public.trigger_set_user_tracking();

-- A user can read their own district_membership rows; super-admins read all.
create policy district_memberships_read_own
  on public.district_memberships
  for select
  to authenticated
  using (account_id = public.get_user_personal_account_id());

create policy super_admins_read_district_memberships
  on public.district_memberships
  for select
  to authenticated
  using (public.is_super_admin());

-- ============================================================
-- Scoping helper functions (security definer — break RLS recursion)
-- ============================================================

-- Is the current user an admin of the given district?
create or replace function public.is_district_admin_of(target_district_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.district_memberships dm
    join public.accounts a on a.id = dm.account_id
    where dm.district_id = target_district_id
      and a.primary_owner_user_id = (select auth.uid())
      and a.is_personal_account = true
  );
$$;

grant execute on function public.is_district_admin_of(uuid) to authenticated;

-- The district the current user administers (admins are scoped to one district).
create or replace function public.get_user_district_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select dm.district_id
  from public.district_memberships dm
  join public.accounts a on a.id = dm.account_id
  where a.primary_owner_user_id = (select auth.uid())
    and a.is_personal_account = true
  limit 1;
$$;

grant execute on function public.get_user_district_id() to authenticated;

-- Does the given ORG ACCOUNT belong to a district the current user administers?
create or replace function public.org_in_my_district(target_org_account_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_profiles op
    join public.district_memberships dm on dm.district_id = op.district_id
    join public.accounts a on a.id = dm.account_id
    where op.account_id = target_org_account_id
      and op.district_id is not null
      and a.primary_owner_user_id = (select auth.uid())
      and a.is_personal_account = true
  );
$$;

grant execute on function public.org_in_my_district(uuid) to authenticated;

-- Does the given user have ANY district membership? SECURITY DEFINER so it can
-- be used inside get_user_platform_role() (which is security invoker) without
-- being blocked by RLS on public.accounts — matching the codebase's pattern of
-- resolving roles through definer helpers.
create or replace function public.user_is_district_admin(target_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.district_memberships dm
    join public.accounts a on a.id = dm.account_id
    where a.primary_owner_user_id = target_user_id
      and a.is_personal_account = true
  );
$$;

grant execute on function public.user_is_district_admin(uuid) to authenticated, service_role;

-- ============================================================
-- Resolve district_admin in get_user_platform_role()
-- (create-or-replace of the function defined in migration
--  20251202204924_consolidate-platform-roles.sql; ranks district_admin above
--  every org role.)
-- ============================================================

create or replace function public.get_user_platform_role(target_user_id uuid default null)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    -- District admins outrank org roles; resolved via district_memberships
    -- through a SECURITY DEFINER helper so RLS on accounts can't hide the row.
    (
      select 'district_admin'
      where public.user_is_district_admin(coalesce(target_user_id, (select auth.uid())))
    ),
    (
      select r.name
      from public.accounts_memberships am
      join public.roles r on r.name = am.account_role
      where am.user_id = coalesce(target_user_id, (select auth.uid()))
      order by r.hierarchy_level asc
      limit 1
    ),
    'cardholder'
  );
$$;

comment on function public.get_user_platform_role(uuid) is
  'Derives a user''s platform role. district_admin (via district_memberships) outranks org roles; otherwise the highest-level accounts_memberships role; else cardholder.';

grant execute on function public.get_user_platform_role(uuid) to authenticated, service_role;

-- ============================================================
-- Additive RLS: let a district_admin SEE their district's orgs + members
-- (All permissive/OR — they only GRANT extra visibility, never restrict
--  existing access, so shipped flows are unaffected.)
-- ============================================================

-- Read organization profiles of chapters in my district.
create policy district_admins_read_org_profiles
  on public.organization_profiles
  for select
  to authenticated
  using (district_id is not null and public.is_district_admin_of(district_id));

-- Read the org (chapter) accounts in my district (names, etc.).
create policy district_admins_read_district_org_accounts
  on public.accounts
  for select
  to authenticated
  using (public.org_in_my_district(id));

-- Read the memberships (org_admins + distributors) of chapters in my district.
create policy district_admins_read_district_memberships_rows
  on public.accounts_memberships
  for select
  to authenticated
  using (public.org_in_my_district(account_id));

-- REVIEW (T3/T7): distributor *personal* account names/leaderboard visibility
-- for district_admin is intentionally NOT added here yet — add when the
-- district roll-up RPCs (T3) define exactly which columns they need.
