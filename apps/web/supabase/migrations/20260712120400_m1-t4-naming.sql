-- Migration: M1 / T4 — Naming layer resolvers (Campus/Chapter/Member)
--
-- Server-side resolution of a district's naming_preset so RPCs/emails/SMS (and
-- the app UI) can render the right nouns. The label strings themselves live in
-- TS (apps/web/lib/naming.ts); these functions only resolve WHICH preset applies
-- to a district or to the current user's district context. Default preset is
-- district_org_member (non-campus).

-- Preset for a specific district (default if missing/inactive/unknown).
create or replace function public.get_district_naming_preset(p_district_id uuid)
returns public.district_naming_preset
language sql
stable security invoker
set search_path = ''
as $$
  select coalesce(
    (select naming_preset from public.districts where id = p_district_id and is_active),
    'district_org_member'::public.district_naming_preset
  );
$$;

grant execute on function public.get_district_naming_preset(uuid) to anon, authenticated;

-- Preset for the CURRENT user's district context:
--   1. if a district_admin -> their district's preset
--   2. else if an org_admin/distributor -> their org's district preset
--   3. else default (district_org_member)
-- SECURITY DEFINER so it can resolve across district_memberships / org profiles
-- without being blocked by RLS (read-only, no data returned beyond the preset).
create or replace function public.get_user_naming_preset()
returns public.district_naming_preset
language sql
stable security definer
set search_path = ''
as $$
  select coalesce(
    -- district_admin's district
    (
      select d.naming_preset
      from public.district_memberships dm
      join public.accounts a on a.id = dm.account_id
      join public.districts d on d.id = dm.district_id
      where a.primary_owner_user_id = (select auth.uid())
        and a.is_personal_account = true
      limit 1
    ),
    -- org member's (org_admin/distributor) org district
    (
      select d.naming_preset
      from public.accounts_memberships am
      join public.organization_profiles op on op.account_id = am.account_id
      join public.districts d on d.id = op.district_id
      where am.user_id = (select auth.uid())
        and am.account_role in ('org_admin', 'distributor')
      limit 1
    ),
    'district_org_member'::public.district_naming_preset
  );
$$;

grant execute on function public.get_user_naming_preset() to authenticated;
