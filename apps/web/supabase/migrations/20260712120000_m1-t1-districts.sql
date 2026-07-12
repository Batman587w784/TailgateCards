-- Migration: M1 / T1 — districts table + organization_profiles.district_id
-- NOTE: Copy of schemas/20-districts.sql (new-entity workflow).
-- UNVERIFIED: not applied against a local DB (Docker/local Supabase unavailable
-- in this session). Run `pnpm --filter web supabase migrations up` +
-- `pnpm supabase:web:typegen` locally before merge.

/*
 * -------------------------------------------------------
 * Section: Districts (M1 / T1 — Three-Tier Hierarchy)
 *
 * Adds a grouping layer ABOVE organizations:
 *   District (Campus) -> Organization (Chapter) -> Distributor (Member)
 *
 * Golden rule: extend, don't break. Existing organizations keep
 * `organization_profiles.district_id = null` and behave exactly as before.
 * Cards continue to attribute via `organization_id`; the district is derived
 * through `organization_profiles.district_id` (no denormalization — see T3).
 * -------------------------------------------------------
 */

-- ============================================================
-- Enums
-- ============================================================

create type public.district_type as enum (
  'campus',   -- College campus competition (Campus / Chapter / Member labels)
  'generic'   -- Any other grouping (District / Organization / Member labels)
);

comment on type public.district_type is 'Kind of district; drives the default naming preset and (later) competition behaviour.';

create type public.district_naming_preset as enum (
  'campus_chapter_member',  -- Campus / Chapter / Member
  'district_org_member'     -- District / Organization / Member (default)
);

comment on type public.district_naming_preset is 'Label set used when rendering the District -> Org -> Distributor hierarchy (see T4).';

-- ============================================================
-- Districts table
-- ============================================================

create table if not exists public.districts (
  id uuid primary key default extensions.uuid_generate_v4(),
  name varchar(255) not null,
  district_type public.district_type not null default 'generic',
  naming_preset public.district_naming_preset not null default 'district_org_member',
  is_active boolean not null default true,
  -- Public download/join URL (T5/T6). Nullable now; unique when set.
  share_slug varchar(255) unique,
  -- Competition windows, prize tiers, etc. — filled in by later milestones.
  config jsonb not null default '{}'::jsonb,
  -- Audit fields
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid references auth.users,
  updated_by uuid references auth.users
);

comment on table public.districts is 'Grouping layer above organizations (Campus/District). Orgs link via organization_profiles.district_id; null = standalone org (pre-M1 behaviour).';

alter table public.districts enable row level security;

-- Lock down, then grant explicitly.
revoke all on public.districts from anon, authenticated, service_role;

-- anon + authenticated may read only the non-sensitive identity columns (this
-- feeds the T5 signup picker). Row visibility is further limited to active
-- districts by the districts_public_read policy below.
grant select (id, name, district_type, naming_preset, is_active, share_slug)
  on public.districts to anon, authenticated;

-- Super-admin district management is performed through the service-role admin
-- client (service_role bypasses RLS). REVIEW: if super-admin district CRUD is
-- ever done with the normal authenticated client instead, add authenticated
-- DML grants + is_super_admin() write policies here.
grant select, insert, update, delete on public.districts to service_role;

create index if not exists ix_districts_is_active on public.districts (is_active);

create trigger districts_set_timestamps
before insert or update on public.districts
for each row execute function public.trigger_set_timestamps();

create trigger districts_set_user_tracking
before insert or update on public.districts
for each row execute function public.trigger_set_user_tracking();

-- ============================================================
-- RLS Policies: districts
-- ============================================================

-- Anyone (incl. anon) can read ACTIVE districts. Column exposure is already
-- limited by the column-level grant above.
create policy districts_public_read
  on public.districts
  for select
  to anon, authenticated
  using (is_active);

-- Super-admins can additionally read inactive districts (management views).
create policy super_admins_read_districts
  on public.districts
  for select
  to authenticated
  using (public.is_super_admin());

-- ============================================================
-- Link organizations to a district (nullable; existing orgs stay null)
-- ============================================================

alter table public.organization_profiles
  add column if not exists district_id uuid references public.districts(id) on delete set null;

comment on column public.organization_profiles.district_id is 'Optional district (campus) this organization/chapter belongs to. Null = standalone org, behaves exactly as pre-M1.';

create index if not exists ix_organization_profiles_district_id
  on public.organization_profiles (district_id);
