-- Migration: M1 / T3 — District roll-up stat RPCs
--
-- Sales roll up Distributor -> Org -> District. District is derived via
-- organization_profiles.district_id (cards already carry organization_id); NO
-- denormalization. Mirrors the existing get_org_admin_* stat-RPC pattern:
-- SECURITY DEFINER + explicit access check + per-org share_per_card_cents for
-- revenue. Access: super-admin, or the district_admin of that district.
--
-- These RPCs live in a migration (not a schema file), matching how the existing
-- get_org_admin_* / get_admin_* stat RPCs are managed in this repo.

-- ============================================================
-- get_district_stats — district-wide totals (json)
-- ============================================================
create or replace function public.get_district_stats(
  p_district_id uuid,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns json
language plpgsql
stable security definer
set search_path = ''
as $$
begin
  if not (public.is_super_admin() or public.is_district_admin_of(p_district_id)) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return (
    select json_build_object(
      'district_id', p_district_id,
      'orgs_count', (
        select count(*)::int
        from public.organization_profiles
        where district_id = p_district_id
      ),
      'total_cards', count(c.id)::int,
      'inactive_cards', count(*) filter (where c.status in ('pending', 'paid'))::int,
      'cards_activated', count(*) filter (where c.status = 'activated')::int,
      'expired_cards', count(*) filter (where c.status = 'expired')::int,
      'cancelled_cards', count(*) filter (where c.status = 'cancelled')::int,
      -- Revenue respects each org's own per-card share.
      'total_revenue_cents',
        coalesce(sum(op.share_per_card_cents) filter (where c.status = 'activated'), 0)::bigint
    )
    from public.organization_profiles op
    left join public.cards c
      on c.organization_id = op.account_id
      and (p_date_from is null or c.created_at >= p_date_from)
      and (p_date_to is null or c.created_at <= p_date_to)
    where op.district_id = p_district_id
  );
end;
$$;

grant execute on function public.get_district_stats(uuid, timestamptz, timestamptz) to authenticated;

-- ============================================================
-- get_district_orgs_list — per-chapter roll-up (table)
-- ============================================================
create or replace function public.get_district_orgs_list(
  p_district_id uuid,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table (
  org_account_id uuid,
  organization_name text,
  total_cards bigint,
  cards_activated bigint,
  revenue_cents bigint
)
language plpgsql
stable security definer
set search_path = ''
as $$
begin
  if not (public.is_super_admin() or public.is_district_admin_of(p_district_id)) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return query
    select
      op.account_id as org_account_id,
      op.organization_name::text,
      count(c.id) as total_cards,
      count(*) filter (where c.status = 'activated') as cards_activated,
      (count(*) filter (where c.status = 'activated') * op.share_per_card_cents)::bigint as revenue_cents
    from public.organization_profiles op
    left join public.cards c
      on c.organization_id = op.account_id
      and (p_date_from is null or c.created_at >= p_date_from)
      and (p_date_to is null or c.created_at <= p_date_to)
    where op.district_id = p_district_id
    group by op.account_id, op.organization_name, op.share_per_card_cents
    order by cards_activated desc, total_cards desc, op.organization_name asc;
end;
$$;

grant execute on function public.get_district_orgs_list(uuid, timestamptz, timestamptz) to authenticated;

-- ============================================================
-- get_district_leaderboard — top chapters within the campus (table, ranked)
-- ============================================================
create or replace function public.get_district_leaderboard(
  p_district_id uuid,
  limit_count integer default 10,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table (
  rank bigint,
  org_account_id uuid,
  organization_name text,
  cards_activated bigint,
  revenue_cents bigint
)
language plpgsql
stable security definer
set search_path = ''
as $$
begin
  if not (public.is_super_admin() or public.is_district_admin_of(p_district_id)) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return query
    with per_org as (
      select
        op.account_id as org_account_id,
        op.organization_name::text as organization_name,
        count(*) filter (where c.status = 'activated') as cards_activated,
        (count(*) filter (where c.status = 'activated') * op.share_per_card_cents)::bigint as revenue_cents
      from public.organization_profiles op
      left join public.cards c
        on c.organization_id = op.account_id
        and (p_date_from is null or c.created_at >= p_date_from)
        and (p_date_to is null or c.created_at <= p_date_to)
      where op.district_id = p_district_id
      group by op.account_id, op.organization_name, op.share_per_card_cents
    )
    select
      row_number() over (order by po.cards_activated desc, po.revenue_cents desc, po.organization_name asc) as rank,
      po.org_account_id,
      po.organization_name,
      po.cards_activated,
      po.revenue_cents
    from per_org po
    order by rank
    limit limit_count;
end;
$$;

grant execute on function public.get_district_leaderboard(uuid, integer, timestamptz, timestamptz) to authenticated;
