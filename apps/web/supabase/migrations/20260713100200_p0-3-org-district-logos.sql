-- Migration: M3 / P0-3 — org logos + district logo standardization
--
-- Org logo already lives on accounts.picture_url (super-admin editable). This
-- adds a district-level logo + a "standardize logos" flag: when a district
-- standardizes, its chapters DISPLAY the district's logo (shared-nonprofit
-- case). Resolution is non-destructive (chapter logos are preserved) — the
-- effective logo is computed at read time by get_effective_org_logo(), so the
-- purchase page (and anywhere else) can just call that.

alter table public.districts
  add column if not exists logo_url text;

alter table public.districts
  add column if not exists standardize_logos boolean not null default false;

-- Effective logo for an org (chapter): the district's logo when that district
-- standardizes logos and has one; otherwise the org's own picture_url. Returns
-- only a public logo URL (no PII), so it is anon-callable for the purchase page.
create or replace function public.get_effective_org_logo(p_org_account_id uuid)
returns text
language sql
stable security definer
set search_path = ''
as $$
  select case
    when d.standardize_logos and d.logo_url is not null and length(btrim(d.logo_url)) > 0
      then d.logo_url
    else a.picture_url
  end
  from public.accounts a
  left join public.organization_profiles op on op.account_id = a.id
  left join public.districts d on d.id = op.district_id
  where a.id = p_org_account_id;
$$;

grant execute on function public.get_effective_org_logo(uuid) to anon, authenticated;
