-- Migration: M3 / P0-1 — super-admin Districts (Campus) management support
--
-- Districts already exist (M1). This adds the columns the admin Districts tab
-- needs (state/city, to mirror the Organizations tab) and an ungated revenue
-- rollup helper mirroring get_organization_total_revenue.

alter table public.districts
  add column if not exists state varchar(100);

alter table public.districts
  add column if not exists city varchar(100);

-- Rolled-up revenue for a district = sum over its chapters of
-- (activated cards × that chapter's share). Ungated SQL helper, mirroring
-- public.get_organization_total_revenue (used by the admin loader via the
-- service-role admin client).
create or replace function public.get_district_total_revenue(p_district_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(
    sum(op.share_per_card_cents) filter (where c.status = 'activated'),
    0
  )::bigint
  from public.organization_profiles op
  left join public.cards c on c.organization_id = op.account_id
  where op.district_id = p_district_id;
$$;
