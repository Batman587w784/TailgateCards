-- Migration: M2 / T2 — Goals (chapter + member) + progress in leaderboards
--
-- Goals exist at TWO levels (both needed now: M3 checkout reads chapter + member
-- goals). A polymorphic goals(level, entity_id) table:
--   level='chapter' -> entity_id = the org (chapter) account_id
--   level='member'  -> entity_id = the member's personal account_id
-- Mutations go through authorization-checked SECURITY DEFINER RPCs (set_goal /
-- delete_goal), not broad RLS write policies. Progress (raised ÷ target) is
-- folded into the leaderboard RPCs, and get_goals_for_checkout exposes a clean
-- anon-safe read for the M3 checkout screen (M3 wires it; we do NOT touch
-- checkout here).
--
-- // REVIEW: entity_id is polymorphic (no FK), so deleting an org/member leaves
-- an orphan goal row. Harmless (leaderboards left-join by live entities), but a
-- cleanup trigger could be added later.

create type public.goal_level as enum ('chapter', 'member');

create table if not exists public.goals (
  id uuid primary key default extensions.uuid_generate_v4(),
  level public.goal_level not null,
  entity_id uuid not null,
  target_cards integer,
  target_cents bigint,
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid references auth.users,
  updated_by uuid references auth.users,
  unique (level, entity_id),
  constraint goals_target_present check (target_cards is not null or target_cents is not null),
  constraint goals_target_nonneg check (
    coalesce(target_cards, 0) >= 0 and coalesce(target_cents, 0) >= 0
  )
);

comment on table public.goals is 'Fundraising goals at chapter (entity=org account) or member (entity=personal account) level. Targets are non-sensitive; progress is shown publicly via leaderboard RPCs. Writes go through set_goal/delete_goal.';

alter table public.goals enable row level security;

revoke all on public.goals from anon, authenticated, service_role;
grant select on public.goals to authenticated;
grant select, insert, update, delete on public.goals to service_role;

create index if not exists ix_goals_level_entity on public.goals (level, entity_id);

create trigger goals_set_timestamps
before insert or update on public.goals
for each row execute function public.trigger_set_timestamps();

create trigger goals_set_user_tracking
before insert or update on public.goals
for each row execute function public.trigger_set_user_tracking();

-- ============================================================
-- Authorization: who may manage a goal
--   chapter -> super-admin / district_admin(of the chapter's district) / org_admin(of the chapter)
--   member  -> the member themselves / their org_admin / their district_admin / super-admin
-- ============================================================
create or replace function public.can_manage_goal(
  p_level public.goal_level,
  p_entity_id uuid
)
returns boolean
language plpgsql
stable security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_district uuid;
begin
  if public.is_super_admin() then
    return true;
  end if;

  if p_level = 'chapter' then
    if public.has_role_on_account(p_entity_id, 'org_admin') then
      return true;
    end if;
    select district_id into v_district
      from public.organization_profiles where account_id = p_entity_id;
    return v_district is not null and public.is_district_admin_of(v_district);
  else
    -- member: the member themselves
    if p_entity_id = public.get_user_personal_account_id() then
      return true;
    end if;
    -- or an admin over the member's chapter
    select am.account_id into v_org
      from public.accounts_memberships am
      join public.accounts a
        on a.id = p_entity_id and a.primary_owner_user_id = am.user_id
     where am.account_role = 'distributor'
     limit 1;

    if v_org is null then
      return false;
    end if;

    if public.has_role_on_account(v_org, 'org_admin') then
      return true;
    end if;

    select district_id into v_district
      from public.organization_profiles where account_id = v_org;
    return v_district is not null and public.is_district_admin_of(v_district);
  end if;
end;
$$;

grant execute on function public.can_manage_goal(public.goal_level, uuid) to authenticated;

-- Read policy: you can read the goals you can manage (management views).
-- The public leaderboards read goals via SECURITY DEFINER RPCs (bypass RLS), so
-- anon never needs direct table access.
create policy goals_read
  on public.goals
  for select
  to authenticated
  using (public.can_manage_goal(level, entity_id));

-- ============================================================
-- set_goal / delete_goal (authorization-checked mutations)
-- ============================================================
create or replace function public.set_goal(
  p_level public.goal_level,
  p_entity_id uuid,
  p_target_cards int default null,
  p_target_cents bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.can_manage_goal(p_level, p_entity_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if p_target_cards is null and p_target_cents is null then
    raise exception 'A target (cards or dollars) is required' using errcode = '22023';
  end if;

  insert into public.goals (level, entity_id, target_cards, target_cents)
  values (p_level, p_entity_id, p_target_cards, p_target_cents)
  on conflict (level, entity_id)
  do update set target_cards = excluded.target_cards, target_cents = excluded.target_cents
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.set_goal(public.goal_level, uuid, int, bigint) to authenticated;

create or replace function public.delete_goal(
  p_level public.goal_level,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_goal(p_level, p_entity_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  delete from public.goals where level = p_level and entity_id = p_entity_id;
end;
$$;

grant execute on function public.delete_goal(public.goal_level, uuid) to authenticated;

-- ============================================================
-- get_goals_for_checkout — anon-safe read for the M3 checkout (numbers only)
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
  v_ch_target_cards int;
  v_ch_target_cents bigint;
  v_mb_cards bigint;
  v_mb_raised bigint;
  v_mb_target_cards int;
  v_mb_target_cents bigint;
begin
  select share_per_card_cents into v_share
    from public.organization_profiles where account_id = p_org_account_id;

  if v_share is null then
    return null;
  end if;

  -- chapter totals
  select count(*) filter (where status = 'activated')
    into v_ch_cards
    from public.cards where organization_id = p_org_account_id;
  v_ch_raised := (v_ch_cards * v_share)::bigint;

  select target_cards, target_cents into v_ch_target_cards, v_ch_target_cents
    from public.goals where level = 'chapter' and entity_id = p_org_account_id;

  -- member totals (optional)
  if p_member_account_id is not null then
    select count(*) filter (where status = 'activated')
      into v_mb_cards
      from public.cards
     where distributor_id = p_member_account_id
       and organization_id = p_org_account_id;
    v_mb_raised := (coalesce(v_mb_cards, 0) * v_share)::bigint;

    select target_cards, target_cents into v_mb_target_cards, v_mb_target_cents
      from public.goals where level = 'member' and entity_id = p_member_account_id;
  end if;

  return json_build_object(
    'chapter', json_build_object(
      'cards_sold', v_ch_cards,
      'raised_cents', v_ch_raised,
      'target_cards', v_ch_target_cards,
      'target_cents', v_ch_target_cents,
      'progress', public.goal_progress(v_ch_cards, v_ch_raised, v_ch_target_cards, v_ch_target_cents)
    ),
    'member', case when p_member_account_id is null then null else json_build_object(
      'cards_sold', coalesce(v_mb_cards, 0),
      'raised_cents', coalesce(v_mb_raised, 0),
      'target_cards', v_mb_target_cards,
      'target_cents', v_mb_target_cents,
      'progress', public.goal_progress(coalesce(v_mb_cards, 0), coalesce(v_mb_raised, 0), v_mb_target_cards, v_mb_target_cents)
    ) end
  );
end;
$$;

grant execute on function public.get_goals_for_checkout(uuid, uuid) to anon, authenticated;

-- Shared progress helper: dollars-target first, else cards-target, else null.
create or replace function public.goal_progress(
  p_cards bigint,
  p_raised_cents bigint,
  p_target_cards int,
  p_target_cents bigint
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_target_cents is not null and p_target_cents > 0
      then round(coalesce(p_raised_cents, 0)::numeric / p_target_cents, 4)
    when p_target_cards is not null and p_target_cards > 0
      then round(coalesce(p_cards, 0)::numeric / p_target_cards, 4)
    else null
  end;
$$;

grant execute on function public.goal_progress(bigint, bigint, int, bigint) to anon, authenticated;

-- ============================================================
-- Recreate leaderboard RPCs to include goal target + progress
-- (return-shape changes -> DROP then CREATE)
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
    goal_target_cards, goal_target_cents,
    public.goal_progress(cards_sold, dollars_raised_cents, goal_target_cards, goal_target_cents) as goal_progress
  from (
    select
      op.account_id as org_account_id,
      op.organization_name::text as chapter_name,
      count(*) filter (where c.status = 'activated') as cards_sold,
      (count(*) filter (where c.status = 'activated') * op.share_per_card_cents)::bigint as dollars_raised_cents,
      g.target_cards as goal_target_cards,
      g.target_cents as goal_target_cents
    from public.organization_profiles op
    left join public.cards c on c.organization_id = op.account_id
    left join public.goals g on g.level = 'chapter' and g.entity_id = op.account_id
    where op.district_id = p_district_id and op.is_active
    group by op.account_id, op.organization_name, op.share_per_card_cents, g.target_cards, g.target_cents
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
    display_name, cards_sold, dollars_raised_cents, goal_target_cards, goal_target_cents,
    public.goal_progress(cards_sold, dollars_raised_cents, goal_target_cards, goal_target_cents) as goal_progress
  from (
    select
      public.public_display_name(a.name) as display_name,
      count(*) filter (where c.status = 'activated') as cards_sold,
      (count(*) filter (where c.status = 'activated') * op.share_per_card_cents)::bigint as dollars_raised_cents,
      g.target_cards as goal_target_cards,
      g.target_cents as goal_target_cents
    from public.accounts_memberships am
    join public.accounts a on a.primary_owner_user_id = am.user_id and a.is_personal_account = true
    join public.organization_profiles op on op.account_id = am.account_id
    left join public.cards c on c.distributor_id = a.id and c.organization_id = am.account_id
    left join public.goals g on g.level = 'member' and g.entity_id = a.id
    where op.district_id = p_district_id and op.is_active and am.account_role = 'distributor'
    group by a.id, a.name, op.share_per_card_cents, g.target_cards, g.target_cents
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
    display_name, cards_sold, dollars_raised_cents, goal_target_cards, goal_target_cents,
    public.goal_progress(cards_sold, dollars_raised_cents, goal_target_cards, goal_target_cents) as goal_progress
  from (
    select
      public.public_display_name(a.name) as display_name,
      count(*) filter (where c.status = 'activated') as cards_sold,
      (count(*) filter (where c.status = 'activated') * op.share_per_card_cents)::bigint as dollars_raised_cents,
      g.target_cards as goal_target_cards,
      g.target_cents as goal_target_cents
    from public.accounts_memberships am
    join public.accounts a on a.primary_owner_user_id = am.user_id and a.is_personal_account = true
    join public.organization_profiles op on op.account_id = am.account_id
    left join public.cards c on c.distributor_id = a.id and c.organization_id = am.account_id
    left join public.goals g on g.level = 'member' and g.entity_id = a.id
    where am.account_id = p_org_account_id and am.account_role = 'distributor'
    group by a.id, a.name, op.share_per_card_cents, g.target_cards, g.target_cents
  ) per_member
  order by rank
  limit p_limit;
$$;

grant execute on function public.get_chapter_member_leaderboard(uuid, int) to anon, authenticated;

-- get_my_leaderboard_position returns json (type unchanged) -> replace in place.
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
  v_target_cards int;
  v_target_cents bigint;
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

  select target_cards, target_cents into v_target_cards, v_target_cents
    from public.goals where level = 'member' and entity_id = v_member_account_id;

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
    'goal_target_cards', v_target_cards,
    'goal_target_cents', v_target_cents,
    'goal_progress', public.goal_progress(v_cards_sold, v_raised, v_target_cards, v_target_cents)
  );
end;
$$;

grant execute on function public.get_my_leaderboard_position() to authenticated;
