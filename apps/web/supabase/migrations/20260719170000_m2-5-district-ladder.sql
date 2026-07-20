-- ─────────────────────────────────────────────────────────────────────────────
-- M2.5-b/c — get_district_ladder: everything the prize ladder + crown need for a
-- district, in one public call (the ladder is visible to everyone, §1).
--
-- total_cards is the district's collective progress on the paid+activated basis
-- (§0.2), so tier progress can never contradict the leaderboards. Thresholds are
-- card counts (§0.3). Returns the collective (district-scope) tiers for the
-- ladder plus the top-chapter / top-individual prize names for the crown (c).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_district_ladder(p_district_id uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'district_id', d.id,
    'district_name', d.name,
    'fundraiser_enabled', d.fundraiser_enabled,
    'competition_start', d.config->>'competition_start',
    'competition_days', nullif(d.config->>'competition_days', '')::int,
    'total_cards', coalesce((
      select count(*) filter (where c.status in ('paid', 'activated'))
      from public.organization_profiles op
      left join public.cards c on c.organization_id = op.account_id
      where op.district_id = d.id and op.is_active
    ), 0),
    'tiers', coalesce((
      select json_agg(json_build_object(
        'id', t.id,
        'name', t.name,
        'description', t.description,
        'image_url', t.image_url,
        'threshold_cards', t.threshold_cards
      ) order by t.threshold_cards)
      from public.prize_tiers t
      where t.district_id = d.id and t.scope = 'district' and t.is_active
    ), '[]'::json),
    'chapter_prize', (
      select t.name from public.prize_tiers t
      where t.district_id = d.id and t.scope = 'chapter' and t.is_active
      order by t.display_order, t.threshold_cards
      limit 1
    ),
    'individual_prize', (
      select t.name from public.prize_tiers t
      where t.district_id = d.id and t.scope = 'individual' and t.is_active
      order by t.display_order, t.threshold_cards
      limit 1
    )
  )
  from public.districts d
  where d.id = p_district_id;
$$;

grant execute on function public.get_district_ladder(uuid) to anon, authenticated;
