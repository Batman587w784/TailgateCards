-- Migration: M2 / T2 — AUTOMATIC goals (revised)
--
-- No manual goals, no per-entity config, no editing UI. The display goal is
-- derived purely from current raised, at MEMBER, CHAPTER, and CAMPUS/DISTRICT
-- levels, by one rule for everyone: a GoFundMe-style ratchet where the goal is
-- current-raised rounded UP to a clean number so the progress bar sits ~70% full
-- and grows as raised climbs — never fully completing.
--
-- goal = max(FLOOR, ceil( (raised / RATIO) / step ) * step)
--   - RATIO 0.70 -> progress = raised/goal is always <= ~70% (never 100%).
--   - rounded UP to a clean `step` (scales with magnitude) -> clean numbers.
--   - FLOOR gives a sensible starter goal at low raised and keeps goal(raised)
--     monotonically non-decreasing (a true ratchet: the goal never drops).
--
-- // REVIEW: the RATIO (0.70), the $500 FLOOR, and the clean-rounding `step`
-- table below are the tunables — adjust to taste; nothing else depends on them.
--
-- Replaces the earlier manual-goals version of this ticket: the goals table,
-- goal_level enum, set_goal/delete_goal/can_manage_goal, and the old
-- goal_progress() helper are all gone (dropped here; not created on a fresh
-- reset since this migration no longer creates them).

drop function if exists public.set_goal(public.goal_level, uuid, int, bigint);
drop function if exists public.delete_goal(public.goal_level, uuid);
drop function if exists public.can_manage_goal(public.goal_level, uuid);
drop table if exists public.goals cascade;
drop type if exists public.goal_level;
drop function if exists public.goal_progress(bigint, bigint, int, bigint);

-- ============================================================
-- Auto-goal ratchet (dollars/cents)
-- ============================================================
create or replace function public.auto_goal_cents(p_raised_cents bigint)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_target numeric;
  v_step numeric;
begin
  -- Target that would make the bar sit at RATIO full.
  v_target := greatest(coalesce(p_raised_cents, 0), 0) / 0.70;  -- // REVIEW ratio

  -- Clean rounding step, scaling with magnitude (cents).  // REVIEW steps
  v_step := case
    when v_target < 5000 then 500          -- < $50   -> $5
    when v_target < 20000 then 1000        -- < $200  -> $10
    when v_target < 50000 then 2500        -- < $500  -> $25
    when v_target < 100000 then 5000       -- < $1k   -> $50
    when v_target < 500000 then 25000      -- < $5k   -> $250
    when v_target < 1000000 then 50000     -- < $10k  -> $500
    when v_target < 5000000 then 100000    -- < $50k  -> $1k
    when v_target < 10000000 then 500000   -- < $100k -> $5k
    else 1000000                           -- >=$100k -> $10k
  end;

  -- Round the target UP to a clean step; never below the $500 floor.
  return greatest(50000::numeric, ceil(v_target / v_step) * v_step)::bigint;  -- // REVIEW $500 floor
end;
$$;

grant execute on function public.auto_goal_cents(bigint) to anon, authenticated;

-- Progress = raised / auto-goal, in [0, ~0.70]. Never reaches 1 (never completes).
create or replace function public.auto_goal_progress(p_raised_cents bigint)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(
    greatest(coalesce(p_raised_cents, 0), 0)::numeric / public.auto_goal_cents(p_raised_cents),
    4
  );
$$;

grant execute on function public.auto_goal_progress(bigint) to anon, authenticated;

-- ============================================================
-- Leaderboard RPCs — goal columns now come from the auto-goal.
-- Output shapes are unchanged (goal_target_cards is always null; dollars-only
-- auto-goal), so the UI needs no changes for the boards.
-- ============================================================
drop function if exists public.get_campus_chapter_leaderboard(uuid);
create function public.get_campus_chapter_leaderboard(p_district_id uuid)
returns table (
  rank bigint,
  org_account_id uuid,
  chapter_name text,
  cards_sold bigint,
  dollars_raised_cents bigint,
  goal_target_cards int,
  goal_target_cents bigint,
  goal_progress numeric
)
language sql
stable security definer
set search_path = ''
as $$
  select
    row_number() over (order by cards_sold desc, dollars_raised_cents desc, chapter_name asc) as rank,
    org_account_id, chapter_name, cards_sold, dollars_raised_cents,
    null::int as goal_target_cards,
    public.auto_goal_cents(dollars_raised_cents) as goal_target_cents,
    public.auto_goal_progress(dollars_raised_cents) as goal_progress
  from (
    select
      op.account_id as org_account_id,
      op.organization_name::text as chapter_name,
      count(*) filter (where c.status = 'activated') as cards_sold,
      (count(*) filter (where c.status = 'activated') * op.share_per_card_cents)::bigint as dollars_raised_cents
    from public.organization_profiles op
    left join public.cards c on c.organization_id = op.account_id
    where op.district_id = p_district_id and op.is_active
    group by op.account_id, op.organization_name, op.share_per_card_cents
  ) per_chapter
  order by rank;
$$;

grant execute on function public.get_campus_chapter_leaderboard(uuid) to anon, authenticated;

drop function if exists public.get_campus_member_leaderboard(uuid, int);
create function public.get_campus_member_leaderboard(p_district_id uuid, p_limit int default 100)
returns table (
  rank bigint,
  display_name text,
  cards_sold bigint,
  dollars_raised_cents bigint,
  goal_target_cards int,
  goal_target_cents bigint,
  goal_progress numeric
)
language sql
stable security definer
set search_path = ''
as $$
  select
    row_number() over (order by cards_sold desc, dollars_raised_cents desc, display_name asc) as rank,
    display_name, cards_sold, dollars_raised_cents,
    null::int as goal_target_cards,
    public.auto_goal_cents(dollars_raised_cents) as goal_target_cents,
    public.auto_goal_progress(dollars_raised_cents) as goal_progress
  from (
    select
      public.public_display_name(a.name) as display_name,
      count(*) filter (where c.status = 'activated') as cards_sold,
      (count(*) filter (where c.status = 'activated') * op.share_per_card_cents)::bigint as dollars_raised_cents
    from public.accounts_memberships am
    join public.accounts a on a.primary_owner_user_id = am.user_id and a.is_personal_account = true
    join public.organization_profiles op on op.account_id = am.account_id
    left join public.cards c on c.distributor_id = a.id and c.organization_id = am.account_id
    where op.district_id = p_district_id and op.is_active and am.account_role = 'distributor'
    group by a.id, a.name, op.share_per_card_cents
  ) per_member
  order by rank
  limit p_limit;
$$;

grant execute on function public.get_campus_member_leaderboard(uuid, int) to anon, authenticated;

drop function if exists public.get_chapter_member_leaderboard(uuid, int);
create function public.get_chapter_member_leaderboard(p_org_account_id uuid, p_limit int default 100)
returns table (
  rank bigint,
  display_name text,
  cards_sold bigint,
  dollars_raised_cents bigint,
  goal_target_cards int,
  goal_target_cents bigint,
  goal_progress numeric
)
language sql
stable security definer
set search_path = ''
as $$
  select
    row_number() over (order by cards_sold desc, dollars_raised_cents desc, display_name asc) as rank,
    display_name, cards_sold, dollars_raised_cents,
    null::int as goal_target_cards,
    public.auto_goal_cents(dollars_raised_cents) as goal_target_cents,
    public.auto_goal_progress(dollars_raised_cents) as goal_progress
  from (
    select
      public.public_display_name(a.name) as display_name,
      count(*) filter (where c.status = 'activated') as cards_sold,
      (count(*) filter (where c.status = 'activated') * op.share_per_card_cents)::bigint as dollars_raised_cents
    from public.accounts_memberships am
    join public.accounts a on a.primary_owner_user_id = am.user_id and a.is_personal_account = true
    join public.organization_profiles op on op.account_id = am.account_id
    left join public.cards c on c.distributor_id = a.id and c.organization_id = am.account_id
    where am.account_id = p_org_account_id and am.account_role = 'distributor'
    group by a.id, a.name, op.share_per_card_cents
  ) per_member
  order by rank
  limit p_limit;
$$;

grant execute on function public.get_chapter_member_leaderboard(uuid, int) to anon, authenticated;

-- ============================================================
-- Campus summary — now includes the CAMPUS-level auto-goal + progress.
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
    'total_raised_cents', tr.raised,
    'total_cards_sold', tr.sold,
    'chapter_count', cc.cnt,
    'goal_target_cents', public.auto_goal_cents(tr.raised),
    'goal_progress', public.auto_goal_progress(tr.raised)
  )
  from public.districts d
  cross join lateral (
    select
      coalesce(sum(op.share_per_card_cents) filter (where c.status = 'activated'), 0)::bigint as raised,
      coalesce(count(*) filter (where c.status = 'activated'), 0)::bigint as sold
    from public.organization_profiles op
    left join public.cards c on c.organization_id = op.account_id
    where op.district_id = d.id and op.is_active
  ) tr
  cross join lateral (
    select count(*) as cnt from public.organization_profiles
    where district_id = d.id and is_active
  ) cc
  where d.id = p_district_id and d.is_active;
$$;

grant execute on function public.get_campus_leaderboard_summary(uuid) to anon, authenticated;

-- ============================================================
-- Authenticated: the caller's own position — member auto-goal.
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
  v_raised bigint;
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
  v_raised := (v_cards_sold * v_share)::bigint;

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
    'dollars_raised_cents', v_raised,
    'chapter_rank', v_chapter_rank,
    'goal_target_cards', null,
    'goal_target_cents', public.auto_goal_cents(v_raised),
    'goal_progress', public.auto_goal_progress(v_raised)
  );
end;
$$;

grant execute on function public.get_my_leaderboard_position() to authenticated;

-- ============================================================
-- M3 checkout read — auto member + chapter goals (numbers only, anon-safe).
-- ============================================================
create or replace function public.get_goals_for_checkout(
  p_org_account_id uuid,
  p_member_account_id uuid default null
)
returns json
language plpgsql
stable security definer
set search_path = ''
as $$
declare
  v_share int;
  v_ch_cards bigint;
  v_ch_raised bigint;
  v_mb_cards bigint;
  v_mb_raised bigint;
begin
  select share_per_card_cents into v_share
    from public.organization_profiles where account_id = p_org_account_id;

  if v_share is null then
    return null;
  end if;

  select count(*) filter (where status = 'activated')
    into v_ch_cards
    from public.cards where organization_id = p_org_account_id;
  v_ch_raised := (v_ch_cards * v_share)::bigint;

  if p_member_account_id is not null then
    select count(*) filter (where status = 'activated')
      into v_mb_cards
      from public.cards
     where distributor_id = p_member_account_id and organization_id = p_org_account_id;
    v_mb_raised := (coalesce(v_mb_cards, 0) * v_share)::bigint;
  end if;

  return json_build_object(
    'chapter', json_build_object(
      'cards_sold', v_ch_cards,
      'raised_cents', v_ch_raised,
      'target_cents', public.auto_goal_cents(v_ch_raised),
      'progress', public.auto_goal_progress(v_ch_raised)
    ),
    'member', case when p_member_account_id is null then null else json_build_object(
      'cards_sold', coalesce(v_mb_cards, 0),
      'raised_cents', coalesce(v_mb_raised, 0),
      'target_cents', public.auto_goal_cents(coalesce(v_mb_raised, 0)),
      'progress', public.auto_goal_progress(coalesce(v_mb_raised, 0))
    ) end
  );
end;
$$;

grant execute on function public.get_goals_for_checkout(uuid, uuid) to anon, authenticated;
