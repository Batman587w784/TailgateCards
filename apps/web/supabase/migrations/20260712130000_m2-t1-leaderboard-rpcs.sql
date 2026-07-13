-- Migration: M2 / T1 — Leaderboard RPCs (additive on M1)
--
-- Rank by cards SOLD, display DOLLARS raised. To keep "campus total = sum of
-- chapters" reconciling with M1's get_district_stats, the metric basis is the
-- SAME as that roll-up: activated cards, dollars = activated × the org's
-- share_per_card_cents.
--
-- // REVIEW (sold vs activated): "sold" here means status='activated' to match
-- M1's revenue roll-up (get_district_stats). A card that is 'paid' but not yet
-- 'activated' is a completed sale but is NOT counted (mirrors M1). If the
-- campus-total headline should include paid-not-activated sales, change the
-- filter here AND in get_district_stats together so they stay reconciled.
--
-- ZERO PII: every anon-callable function returns only public labels + numbers —
-- campus name, chapter (organization) name, and public_display_name (first name
-- + last initial). Never email/phone/address/full name. These are SECURITY
-- DEFINER and do NOT rely on any anon RLS read policy (golden rule: do not reuse
-- the organization_profiles over-exposure).

-- ============================================================
-- PII-safe member display name: "John Smith" -> "John S.", "John" -> "John"
-- ============================================================
create or replace function public.public_display_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name is null or btrim(p_name) = '' then 'Member'
    when array_length(regexp_split_to_array(btrim(p_name), '\s+'), 1) = 1
      then (regexp_split_to_array(btrim(p_name), '\s+'))[1]
    else (regexp_split_to_array(btrim(p_name), '\s+'))[1]
         || ' '
         || left(
              (regexp_split_to_array(btrim(p_name), '\s+'))[
                array_length(regexp_split_to_array(btrim(p_name), '\s+'), 1)
              ],
              1
            )
         || '.'
  end;
$$;

grant execute on function public.public_display_name(text) to anon, authenticated;

-- ============================================================
-- Resolve a public campus by its share_slug (active only)
-- ============================================================
create or replace function public.get_public_campus(p_share_slug text)
returns table (
  district_id uuid,
  campus_name text,
  naming_preset public.district_naming_preset
)
language sql
stable security definer
set search_path = ''
as $$
  select id, name::text, naming_preset
  from public.districts
  where share_slug = p_share_slug and is_active;
$$;

grant execute on function public.get_public_campus(text) to anon, authenticated;

-- ============================================================
-- Campus headline: total raised + total sold + chapter count
-- (reconciles with M1 get_district_stats revenue)
-- ============================================================
create or replace function public.get_campus_leaderboard_summary(p_district_id uuid)
returns json
language sql
stable security definer
set search_path = ''
as $$
  select json_build_object(
    'district_id', d.id,
    'campus_name', d.name,
    'naming_preset', d.naming_preset,
    'total_raised_cents', coalesce((
      select sum(op.share_per_card_cents) filter (where c.status = 'activated')
      from public.organization_profiles op
      left join public.cards c on c.organization_id = op.account_id
      where op.district_id = d.id and op.is_active
    ), 0)::bigint,
    'total_cards_sold', coalesce((
      select count(*) filter (where c.status = 'activated')
      from public.organization_profiles op
      left join public.cards c on c.organization_id = op.account_id
      where op.district_id = d.id and op.is_active
    ), 0)::bigint,
    'chapter_count', (
      select count(*) from public.organization_profiles
      where district_id = d.id and is_active
    )
  )
  from public.districts d
  where d.id = p_district_id and d.is_active;
$$;

grant execute on function public.get_campus_leaderboard_summary(uuid) to anon, authenticated;

-- ============================================================
-- Chapter-within-campus leaderboard (chapter display name + numbers)
-- ============================================================
create or replace function public.get_campus_chapter_leaderboard(p_district_id uuid)
returns table (
  rank bigint,
  org_account_id uuid,
  chapter_name text,
  cards_sold bigint,
  dollars_raised_cents bigint
)
language sql
stable security definer
set search_path = ''
as $$
  select rank, org_account_id, chapter_name, cards_sold, dollars_raised_cents
  from (
    select
      row_number() over (
        order by cards_sold desc, dollars_raised_cents desc, chapter_name asc
      ) as rank,
      org_account_id, chapter_name, cards_sold, dollars_raised_cents
    from (
      select
        op.account_id as org_account_id,
        op.organization_name::text as chapter_name,
        count(*) filter (where c.status = 'activated') as cards_sold,
        (count(*) filter (where c.status = 'activated') * op.share_per_card_cents)::bigint
          as dollars_raised_cents
      from public.organization_profiles op
      left join public.cards c on c.organization_id = op.account_id
      where op.district_id = p_district_id and op.is_active
      group by op.account_id, op.organization_name, op.share_per_card_cents
    ) per_chapter
  ) ranked
  order by rank;
$$;

grant execute on function public.get_campus_chapter_leaderboard(uuid) to anon, authenticated;

-- ============================================================
-- Member leaderboard within a campus (first name + last initial + numbers)
-- ============================================================
create or replace function public.get_campus_member_leaderboard(
  p_district_id uuid,
  p_limit int default 100
)
returns table (
  rank bigint,
  display_name text,
  cards_sold bigint,
  dollars_raised_cents bigint
)
language sql
stable security definer
set search_path = ''
as $$
  select rank, display_name, cards_sold, dollars_raised_cents
  from (
    select
      row_number() over (
        order by cards_sold desc, dollars_raised_cents desc, display_name asc
      ) as rank,
      display_name, cards_sold, dollars_raised_cents
    from (
      select
        public.public_display_name(a.name) as display_name,
        count(*) filter (where c.status = 'activated') as cards_sold,
        (count(*) filter (where c.status = 'activated') * op.share_per_card_cents)::bigint
          as dollars_raised_cents
      from public.accounts_memberships am
      join public.accounts a
        on a.primary_owner_user_id = am.user_id and a.is_personal_account = true
      join public.organization_profiles op on op.account_id = am.account_id
      left join public.cards c
        on c.distributor_id = a.id and c.organization_id = am.account_id
      where op.district_id = p_district_id
        and op.is_active
        and am.account_role = 'distributor'
      group by a.id, a.name, op.share_per_card_cents
    ) per_member
  ) ranked
  order by rank
  limit p_limit;
$$;

grant execute on function public.get_campus_member_leaderboard(uuid, int) to anon, authenticated;

-- ============================================================
-- Member leaderboard within a single chapter (org)
-- ============================================================
create or replace function public.get_chapter_member_leaderboard(
  p_org_account_id uuid,
  p_limit int default 100
)
returns table (
  rank bigint,
  display_name text,
  cards_sold bigint,
  dollars_raised_cents bigint
)
language sql
stable security definer
set search_path = ''
as $$
  select rank, display_name, cards_sold, dollars_raised_cents
  from (
    select
      row_number() over (
        order by cards_sold desc, dollars_raised_cents desc, display_name asc
      ) as rank,
      display_name, cards_sold, dollars_raised_cents
    from (
      select
        public.public_display_name(a.name) as display_name,
        count(*) filter (where c.status = 'activated') as cards_sold,
        (count(*) filter (where c.status = 'activated') * op.share_per_card_cents)::bigint
          as dollars_raised_cents
      from public.accounts_memberships am
      join public.accounts a
        on a.primary_owner_user_id = am.user_id and a.is_personal_account = true
      join public.organization_profiles op on op.account_id = am.account_id
      left join public.cards c
        on c.distributor_id = a.id and c.organization_id = am.account_id
      where am.account_id = p_org_account_id
        and am.account_role = 'distributor'
      group by a.id, a.name, op.share_per_card_cents
    ) per_member
  ) ranked
  order by rank
  limit p_limit;
$$;

grant execute on function public.get_chapter_member_leaderboard(uuid, int) to anon, authenticated;

-- ============================================================
-- Authenticated: the CALLER's own position (their data only)
-- ============================================================
create or replace function public.get_my_leaderboard_position()
returns json
language plpgsql
stable security definer
set search_path = ''
as $$
declare
  v_member_account_id uuid;
  v_org_id uuid;
  v_district_id uuid;
  v_share int;
  v_cards_sold bigint;
  v_chapter_rank bigint;
begin
  select a.id, am.account_id, op.district_id, op.share_per_card_cents
    into v_member_account_id, v_org_id, v_district_id, v_share
  from public.accounts_memberships am
  join public.accounts a
    on a.primary_owner_user_id = (select auth.uid()) and a.is_personal_account = true
  join public.organization_profiles op on op.account_id = am.account_id
  where am.user_id = (select auth.uid()) and am.account_role = 'distributor'
  limit 1;

  if v_member_account_id is null then
    return null;
  end if;

  select count(*) filter (where c.status = 'activated')
    into v_cards_sold
  from public.cards c
  where c.distributor_id = v_member_account_id and c.organization_id = v_org_id;

  select rank into v_chapter_rank
  from (
    select a.id,
      row_number() over (
        order by count(*) filter (where c.status = 'activated') desc, a.id asc
      ) as rank
    from public.accounts_memberships am
    join public.accounts a
      on a.primary_owner_user_id = am.user_id and a.is_personal_account = true
    left join public.cards c
      on c.distributor_id = a.id and c.organization_id = am.account_id
    where am.account_id = v_org_id and am.account_role = 'distributor'
    group by a.id
  ) r
  where r.id = v_member_account_id;

  return json_build_object(
    'org_account_id', v_org_id,
    'district_id', v_district_id,
    'cards_sold', v_cards_sold,
    'dollars_raised_cents', (v_cards_sold * v_share)::bigint,
    'chapter_rank', v_chapter_rank
  );
end;
$$;

grant execute on function public.get_my_leaderboard_position() to authenticated;
