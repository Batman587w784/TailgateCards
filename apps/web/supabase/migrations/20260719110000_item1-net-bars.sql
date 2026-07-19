-- ─────────────────────────────────────────────────────────────────────────────
-- Item 1 / ledger #20 — NET bars. The goal/raised figures shown to supporters
-- and members now track the money that actually reaches the entity named in the
-- headline, not the gross card price:
--   campus-flagged district (headline = nonprofit) -> per-org nonprofit amount
--   otherwise (headline = the org)                  -> org's share_per_card_cents
-- resolved by org_net_cents_per_card(). This SUPERSEDES the gross switch from
-- 20260714110000/20260714120000 for DISPLAYED figures. Basis stays paid+activated
-- (ledger #13) and auto_goal_* still ratchets, so the bar renders the same shape
-- (~70% full) — only the digits shrink. Applied to BOTH the buy page
-- (get_checkout_goals) and the M2 leaderboards so they never disagree.
--
-- NOT changed: admin revenue RPCs (get_organization_total_revenue /
-- get_district_total_revenue) — those are gross revenue to Tailgate, a different
-- (admin-facing) figure, legitimately gross.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Buy-page goals (chapter + distributor)
create or replace function public.get_checkout_goals(
  p_org_account_id uuid,
  p_distributor_account_id uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_price int;   -- gross card face value (kept for reference / per_card.price_cents)
  v_net int;     -- NET per card to the headline entity (ledger #20)
  v_ch_cards bigint;
  v_ch_raised bigint;
  v_mb_cards bigint;
  v_mb_raised bigint;
begin
  select card_price_cents into v_price
  from public.organization_profiles
  where account_id = p_org_account_id;

  if v_price is null then
    return null;
  end if;

  v_net := public.org_net_cents_per_card(p_org_account_id);

  select count(*) filter (where status in ('paid', 'activated'))
    into v_ch_cards
  from public.cards
  where organization_id = p_org_account_id;
  v_ch_raised := (v_ch_cards * v_net)::bigint;

  if p_distributor_account_id is not null then
    select count(*) filter (where status in ('paid', 'activated'))
      into v_mb_cards
    from public.cards
    where organization_id = p_org_account_id
      and distributor_id = p_distributor_account_id;
    v_mb_raised := (coalesce(v_mb_cards, 0) * v_net)::bigint;
  end if;

  return json_build_object(
    'per_card', json_build_object('price_cents', v_price, 'net_cents', v_net),
    'chapter', json_build_object(
      'cards_sold', v_ch_cards,
      'raised_cents', v_ch_raised,
      'goal_cents', public.auto_goal_cents(v_ch_raised),
      'progress', public.auto_goal_progress(v_ch_raised)
    ),
    'distributor', case when p_distributor_account_id is null then null else json_build_object(
      'cards_sold', coalesce(v_mb_cards, 0),
      'raised_cents', coalesce(v_mb_raised, 0),
      'goal_cents', public.auto_goal_cents(coalesce(v_mb_raised, 0)),
      'progress', public.auto_goal_progress(coalesce(v_mb_raised, 0))
    ) end
  );
end;
$function$;

-- 2. Campus summary
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
      coalesce(sum(public.org_net_cents_per_card(op.account_id)) filter (where c.status in ('paid', 'activated')), 0)::bigint as raised,
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

-- 3. Campus → chapter leaderboard
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
      (count(*) filter (where c.status in ('paid', 'activated')) * public.org_net_cents_per_card(op.account_id))::bigint as dollars_raised_cents
    from public.organization_profiles op
    left join public.cards c on c.organization_id = op.account_id
    where op.district_id = p_district_id and op.is_active
    group by op.account_id, op.organization_name
  ) per_chapter
  order by rank;
$$;

-- 4. Campus → member leaderboard
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
      (count(*) filter (where c.status in ('paid', 'activated')) * public.org_net_cents_per_card(op.account_id))::bigint as dollars_raised_cents
    from public.accounts_memberships am
    join public.accounts a on a.primary_owner_user_id = am.user_id and a.is_personal_account = true
    join public.organization_profiles op on op.account_id = am.account_id
    left join public.cards c on c.distributor_id = a.id and c.organization_id = am.account_id
    where op.district_id = p_district_id and op.is_active and am.account_role = 'distributor'
    group by a.id, a.name, op.account_id
  ) per_member
  order by rank
  limit p_limit;
$$;

-- 5. Chapter → member leaderboard
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
      (count(*) filter (where c.status in ('paid', 'activated')) * public.org_net_cents_per_card(op.account_id))::bigint as dollars_raised_cents
    from public.accounts_memberships am
    join public.accounts a on a.primary_owner_user_id = am.user_id and a.is_personal_account = true
    join public.organization_profiles op on op.account_id = am.account_id
    left join public.cards c on c.distributor_id = a.id and c.organization_id = am.account_id
    where am.account_id = p_org_account_id and am.account_role = 'distributor'
    group by a.id, a.name, op.account_id
  ) per_member
  order by rank
  limit p_limit;
$$;

-- 6. My leaderboard position
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
  v_net int;
  v_cards_sold bigint;
  v_raised bigint;
  v_chapter_rank bigint;
begin
  select a.id, am.account_id, op.district_id
    into v_member_account_id, v_org_id, v_district_id
  from public.accounts_memberships am
  join public.accounts a
    on a.primary_owner_user_id = (select auth.uid()) and a.is_personal_account = true
  join public.organization_profiles op on op.account_id = am.account_id
  where am.user_id = (select auth.uid()) and am.account_role = 'distributor'
  limit 1;

  if v_member_account_id is null then
    return null;
  end if;

  v_net := public.org_net_cents_per_card(v_org_id);

  select count(*) filter (where c.status in ('paid', 'activated'))
    into v_cards_sold
  from public.cards c
  where c.distributor_id = v_member_account_id and c.organization_id = v_org_id;
  v_raised := (v_cards_sold * v_net)::bigint;

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

-- 7. get_goals_for_checkout (kept in sync with get_checkout_goals)
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
  v_net int;
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

  v_net := public.org_net_cents_per_card(p_org_account_id);

  select count(*) filter (where status in ('paid', 'activated'))
    into v_ch_cards
    from public.cards where organization_id = p_org_account_id;
  v_ch_raised := (v_ch_cards * v_net)::bigint;

  if p_member_account_id is not null then
    select count(*) filter (where status in ('paid', 'activated'))
      into v_mb_cards
      from public.cards
     where distributor_id = p_member_account_id and organization_id = p_org_account_id;
    v_mb_raised := (coalesce(v_mb_cards, 0) * v_net)::bigint;
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
