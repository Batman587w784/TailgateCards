-- Migration: M1 / T5 — Public signup-picker data (anon-safe)
--
-- Two anon-callable RPCs feeding the Get-Started campus -> chapter pickers.
-- Both are SECURITY DEFINER with an explicit id+name-only projection so no
-- sensitive column (contact, address, pricing, config, share_slug) can leak,
-- and only ACTIVE rows are returned. The orgs list is a definer RPC so it
-- returns a clean id+name-only contract.
--
-- // REVIEW (PRE-EXISTING, out of M1 scope — flagged, NOT fixed here):
-- organization_profiles currently leaks EVERY column to anon. Policy
-- `org_profiles_public_read_card_price` is `for select to anon using (true)`
-- and anon holds column SELECT on sensitive fields, so anon can already read
-- contact_phone, primary_contact_email, address, share_per_card_cents, etc. for
-- all orgs. Intent was to expose only card_price for the public buy page, but
-- RLS gates rows, not columns. Recommended (separate task): narrow the anon
-- column grant to (id, organization_name, card_price_cents, is_active,
-- district_id) or move the buy-page read behind a definer RPC, then confirm
-- get_distributor_buy_page / the org sales link still work. Left as-is here to
-- avoid breaking the live buy flow.

-- List active districts (campus pickers). id + display fields only.
create or replace function public.list_active_districts()
returns table (
  id uuid,
  name text,
  district_type public.district_type,
  naming_preset public.district_naming_preset
)
language sql
stable security definer
set search_path = ''
as $$
  select d.id, d.name::text, d.district_type, d.naming_preset
  from public.districts d
  where d.is_active
  order by d.name asc;
$$;

grant execute on function public.list_active_districts() to anon, authenticated;

-- List active organizations (chapters) within a given active district.
-- id + display name only.
create or replace function public.list_active_district_orgs(p_district_id uuid)
returns table (
  org_account_id uuid,
  organization_name text
)
language sql
stable security definer
set search_path = ''
as $$
  select op.account_id as org_account_id, op.organization_name::text
  from public.organization_profiles op
  join public.districts d on d.id = op.district_id
  where op.district_id = p_district_id
    and op.is_active
    and d.is_active
  order by op.organization_name asc;
$$;

grant execute on function public.list_active_district_orgs(uuid) to anon, authenticated;
