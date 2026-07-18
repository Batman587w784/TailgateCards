-- Migration: align leaderboard/goal RPCs to the purchase page's basis
--
-- Decision: "raised" = GROSS campaign dollars (card face value), counted on the
-- PAID basis (status in paid, activated) — money is raised when a card is bought,
-- and the buyer activating later doesn't un-raise it. This matches
-- get_checkout_goals so a chapter never shows two different totals on the buy
-- page vs the leaderboard.
--
-- Change in every function below: status = 'activated'  ->  status in
-- ('paid','activated');  share_per_card_cents  ->  card_price_cents.
-- Signatures unchanged (create or replace only). auto_goal_* is unchanged (it
-- just ratchets whatever raised value it's given, now larger/gross).

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
      coalesce(sum(op.card_price_cents) filter (where c.status in ('paid', 'activated')), 0)::bigint as raised,
      coalesce(count(*) filter (where c.status in ('paid', 'activated')), 0)::bigint as sold
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

create or replace function public.get_campus_chapter_leaderboard(p_district_id uuid)
returns table (
  rank bigint, org_account_id uuid, chapter_name text, cards_sold bigint,
  dollars_raised_cents bigint, goal_target_cards int, goal_target_cents bigint,
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
      count(*) filter (where c.status in ('paid', 'activated')) as cards_sold,
      (count(*) filter (where c.status in ('paid', 'activated')) * op.card_price_cents)::bigint as dollars_raised_cents
    from public.organization_profiles op
    left join public.cards c on c.organization_id = op.account_id
    where op.district_id = p_district_id and op.is_active
    group by op.account_id, op.organization_name, op.card_price_cents
  ) per_chapter
  order by rank;
$$;

create or replace function public.get_campus_member_leaderboard(p_district_id uuid, p_limit int default 100)
returns table (
  rank bigint, display_name text, cards_sold bigint, dollars_raised_cents bigint,
  goal_target_cards int, goal_target_cents bigint, goal_progress numeric
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
      count(*) filter (where c.status in ('paid', 'activated')) as cards_sold,
      (count(*) filter (where c.status in ('paid', 'activated')) * op.card_price_cents)::bigint as dollars_raised_cents
    from public.accounts_memberships am
    join public.accounts a on a.primary_owner_user_id = am.user_id and a.is_personal_account = true
    join public.organization_profiles op on op.account_id = am.account_id
    left join public.cards c on c.distributor_id = a.id and c.organization_id = am.account_id
    where op.district_id = p_district_id and op.is_active and am.account_role = 'distributor'
    group by a.id, a.name, op.card_price_cents
  ) per_member
  order by rank
  limit p_limit;
$$;

create or replace function public.get_chapter_member_leaderboard(p_org_account_id uuid, p_limit int default 100)
returns table (
  rank bigint, display_name text, cards_sold bigint, dollars_raised_cents bigint,
  goal_target_cards int, goal_target_cents bigint, goal_progress numeric
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
      count(*) filter (where c.status in ('paid', 'activated')) as cards_sold,
      (count(*) filter (where c.status in ('paid', 'activated')) * op.card_price_cents)::bigint as dollars_raised_cents
    from public.accounts_memberships am
    join public.accounts a on a.primary_owner_user_id = am.user_id and a.is_personal_account = true
    join public.organization_profiles op on op.account_id = am.account_id
    left join public.cards c on c.distributor_id = a.id and c.organization_id = am.account_id
    where am.account_id = p_org_account_id and am.account_role = 'distributor'
    group by a.id, a.name, op.card_price_cents
  ) per_member
  order by rank
  limit p_limit;
$$;

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
  v_price int;
  v_cards_sold bigint;
  v_raised bigint;
  v_chapter_rank bigint;
begin
  select a.id, am.account_id, op.district_id, op.card_price_cents
    into v_member_account_id, v_org_id, v_district_id, v_price
  from public.accounts_memberships am
  join public.accounts a
    on a.primary_owner_user_id = (select auth.uid()) and a.is_personal_account = true
  join public.organization_profiles op on op.account_id = am.account_id
  where am.user_id = (select auth.uid()) and am.account_role = 'distributor'
  limit 1;

  if v_member_account_id is null then
    return null;
  end if;

  select count(*) filter (where c.status in ('paid', 'activated'))
    into v_cards_sold
  from public.cards c
  where c.distributor_id = v_member_account_id and c.organization_id = v_org_id;
  v_raised := (v_cards_sold * v_price)::bigint;

  select rank into v_chapter_rank
  from (
    select a.id,
      row_number() over (
        order by count(*) filter (where c.status in ('paid', 'activated')) desc, a.id asc
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

-- get_goals_for_checkout also aligned to gross+paid.
-- REVIEW: this now overlaps get_checkout_goals (gross); consolidate later.
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
  v_price int;
  v_ch_cards bigint;
  v_ch_raised bigint;
  v_mb_cards bigint;
  v_mb_raised bigint;
begin
  select card_price_cents into v_price
    from public.organization_profiles where account_id = p_org_account_id;

  if v_price is null then
    return null;
  end if;

  select count(*) filter (where status in ('paid', 'activated'))
    into v_ch_cards
    from public.cards where organization_id = p_org_account_id;
  v_ch_raised := (v_ch_cards * v_price)::bigint;

  if p_member_account_id is not null then
    select count(*) filter (where status in ('paid', 'activated'))
      into v_mb_cards
      from public.cards
     where distributor_id = p_member_account_id and organization_id = p_org_account_id;
    v_mb_raised := (coalesce(v_mb_cards, 0) * v_price)::bigint;
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
