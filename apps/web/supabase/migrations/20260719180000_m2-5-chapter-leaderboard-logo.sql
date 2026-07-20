-- ─────────────────────────────────────────────────────────────────────────────
-- M2.5-d — chapter leaderboard rows carry the effective org logo (§5), so rows
-- render logo + name (Greek-letter monogram fallback is client-side). Reuses
-- get_effective_org_logo (district standardize-logos honored). Adds logo_url to
-- the return, so drop+recreate. Net basis + paid+activated unchanged.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.get_campus_chapter_leaderboard(uuid);

create function public.get_campus_chapter_leaderboard(p_district_id uuid)
returns table (
  rank bigint, org_account_id uuid, chapter_name text, logo_url text,
  cards_sold bigint, dollars_raised_cents bigint, goal_target_cards int,
  goal_target_cents bigint, goal_progress numeric
)
language sql
stable security definer
set search_path = ''
as $$
  select
    row_number() over (order by cards_sold desc, dollars_raised_cents desc, chapter_name asc) as rank,
    org_account_id, chapter_name, logo_url, cards_sold, dollars_raised_cents,
    null::int as goal_target_cards,
    public.auto_goal_cents(dollars_raised_cents) as goal_target_cents,
    public.auto_goal_progress(dollars_raised_cents) as goal_progress
  from (
    select
      op.account_id as org_account_id,
      op.organization_name::text as chapter_name,
      public.get_effective_org_logo(op.account_id) as logo_url,
      count(*) filter (where c.status in ('paid', 'activated')) as cards_sold,
      (count(*) filter (where c.status in ('paid', 'activated')) * public.org_net_cents_per_card(op.account_id))::bigint as dollars_raised_cents
    from public.organization_profiles op
    left join public.cards c on c.organization_id = op.account_id
    where op.district_id = p_district_id and op.is_active
    group by op.account_id, op.organization_name
  ) per_chapter
  order by rank;
$$;

grant execute on function public.get_campus_chapter_leaderboard(uuid)
  to anon, authenticated;
