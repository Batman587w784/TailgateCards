-- ─────────────────────────────────────────────────────────────────────────────
-- M2.5-f / decision #9 — a district general link routes the buyer to pick a
-- chapter first, so every card feeds a house. This RPC lists a district's active
-- chapters (by district share_slug) with the buy-page slug + effective logo, for
-- the picker. Public (anon-callable) like the other buy-page RPCs.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_district_chapter_picker(p_share_slug text)
returns table (
  org_account_id uuid,
  name text,
  slug text,
  logo_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id as org_account_id,
    coalesce(op.organization_name, a.name)::text as name,
    a.slug,
    public.get_effective_org_logo(a.id) as logo_url
  from public.districts d
  join public.organization_profiles op
    on op.district_id = d.id and op.is_active
  join public.accounts a on a.id = op.account_id
  where d.share_slug = p_share_slug and d.is_active
  order by name;
$$;

grant execute on function public.get_district_chapter_picker(text)
  to anon, authenticated;
