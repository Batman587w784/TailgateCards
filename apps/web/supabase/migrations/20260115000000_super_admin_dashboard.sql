-- Super Admin Dashboard - Complete Implementation
-- This migration adds all RPC functions for the super admin dashboard with filtering support

-- 1. Get list of organizations for filter dropdown
create or replace function public.get_admin_organizations_list()
returns table(
  id uuid,
  name text
)
language sql
security definer
set search_path = ''
as $$
  select
    a.id,
    a.name::text
  from public.accounts a
  where a.is_personal_account = false
    and a.name is not null
  order by a.name asc;
$$;

grant execute on function public.get_admin_organizations_list() to authenticated;

-- 2. Get filtered card stats
create or replace function public.get_admin_card_stats_filtered(
  p_organization_id uuid default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result json;
  v_active_cards bigint;
  v_inactive_cards bigint;
  v_cards_with_redemptions bigint;
  v_total_activated bigint;
  v_usage_percentage numeric;
begin
  -- Count active cards (status = 'activated')
  select count(*)
  into v_active_cards
  from public.cards c
  where c.status = 'activated'
    and (p_organization_id is null or c.organization_id = p_organization_id)
    and (p_date_from is null or c.activated_at >= p_date_from)
    and (p_date_to is null or c.activated_at <= p_date_to);

  -- Count inactive cards (status in 'pending', 'paid', 'expired')
  select count(*)
  into v_inactive_cards
  from public.cards c
  where c.status in ('pending', 'paid', 'expired')
    and (p_organization_id is null or c.organization_id = p_organization_id)
    and (p_date_from is null or c.created_at >= p_date_from)
    and (p_date_to is null or c.created_at <= p_date_to);

  -- Count activated cards with at least 1 redemption
  select count(distinct c.id)
  into v_cards_with_redemptions
  from public.cards c
  inner join public.redemptions r on r.card_id = c.id
  where c.status = 'activated'
    and (p_organization_id is null or c.organization_id = p_organization_id)
    and (p_date_from is null or c.activated_at >= p_date_from)
    and (p_date_to is null or c.activated_at <= p_date_to);

  -- Calculate usage percentage
  v_total_activated := v_active_cards;
  if v_total_activated > 0 then
    v_usage_percentage := round((v_cards_with_redemptions::numeric / v_total_activated::numeric) * 100, 1);
  else
    v_usage_percentage := 0;
  end if;

  v_result := json_build_object(
    'active_cards', v_active_cards,
    'inactive_cards', v_inactive_cards,
    'usage_percentage', v_usage_percentage
  );

  return v_result;
end;
$$;

grant execute on function public.get_admin_card_stats_filtered(uuid, timestamptz, timestamptz) to authenticated;

-- 3. Get filtered transaction stats
create or replace function public.get_admin_transaction_stats_filtered(
  p_organization_id uuid default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result json;
  v_total_revenue_cents bigint;
  v_failed_transactions bigint;
begin
  -- Calculate total revenue from paid/activated/expired cards
  select coalesce(sum(c.price_cents), 0)
  into v_total_revenue_cents
  from public.cards c
  where c.status in ('paid', 'activated', 'expired')
    and (p_organization_id is null or c.organization_id = p_organization_id)
    and (p_date_from is null or c.paid_at >= p_date_from)
    and (p_date_to is null or c.paid_at <= p_date_to);

  -- Count failed transactions (cancelled cards)
  select count(*)
  into v_failed_transactions
  from public.cards c
  where c.status = 'cancelled'
    and (p_organization_id is null or c.organization_id = p_organization_id)
    and (p_date_from is null or c.created_at >= p_date_from)
    and (p_date_to is null or c.created_at <= p_date_to);

  v_result := json_build_object(
    'total_revenue_cents', v_total_revenue_cents,
    'failed_transactions', v_failed_transactions
  );

  return v_result;
end;
$$;

grant execute on function public.get_admin_transaction_stats_filtered(uuid, timestamptz, timestamptz) to authenticated;

-- 4. Get card usage distribution for donut chart
create or replace function public.get_admin_card_usage_distribution(
  p_organization_id uuid default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result json;
  v_no_usage bigint;
  v_used_1 bigint;
  v_used_2 bigint;
  v_used_3 bigint;
  v_used_4_plus bigint;
begin
  -- Create temp table with card redemption counts
  create temp table if not exists card_redemption_counts as
  select
    c.id as card_id,
    count(r.id) as redemption_count
  from public.cards c
  left join public.redemptions r on r.card_id = c.id
  where c.status = 'activated'
    and (p_organization_id is null or c.organization_id = p_organization_id)
    and (p_date_from is null or c.activated_at >= p_date_from)
    and (p_date_to is null or c.activated_at <= p_date_to)
  group by c.id;

  -- Count cards by redemption buckets
  select count(*) into v_no_usage from card_redemption_counts where redemption_count = 0;
  select count(*) into v_used_1 from card_redemption_counts where redemption_count = 1;
  select count(*) into v_used_2 from card_redemption_counts where redemption_count = 2;
  select count(*) into v_used_3 from card_redemption_counts where redemption_count = 3;
  select count(*) into v_used_4_plus from card_redemption_counts where redemption_count >= 4;

  drop table if exists card_redemption_counts;

  v_result := json_build_object(
    'no_usage', v_no_usage,
    'used_1_time', v_used_1,
    'used_2_times', v_used_2,
    'used_3_times', v_used_3,
    'used_4_plus_times', v_used_4_plus
  );

  return v_result;
end;
$$;

grant execute on function public.get_admin_card_usage_distribution(uuid, timestamptz, timestamptz) to authenticated;

-- 5. Get cards activated by organization
create or replace function public.get_admin_cards_activated_by_org(
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table(
  organization_id uuid,
  organization_name text,
  activated_count bigint,
  inactive_count bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    a.id as organization_id,
    a.name::text as organization_name,
    count(*) filter (where c.status = 'activated') as activated_count,
    count(*) filter (where c.status in ('pending', 'paid', 'expired')) as inactive_count
  from public.accounts a
  left join public.cards c on c.organization_id = a.id
    and (p_date_from is null or c.created_at >= p_date_from)
    and (p_date_to is null or c.created_at <= p_date_to)
  where a.is_personal_account = false
    and a.name is not null
  group by a.id, a.name
  having count(c.id) > 0
  order by count(*) filter (where c.status = 'activated') desc;
$$;

grant execute on function public.get_admin_cards_activated_by_org(timestamptz, timestamptz) to authenticated;

-- 6. Get recent card activations
create or replace function public.get_admin_recent_activations(
  p_organization_id uuid default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_page int default 1,
  p_limit int default 10
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result json;
  v_total_count bigint;
  v_offset int;
begin
  v_offset := (p_page - 1) * p_limit;

  -- Get total count for pagination
  select count(*)
  into v_total_count
  from public.cardholders_view cv
  where cv.card_status = 'activated'
    and cv.activated_at is not null
    and (p_organization_id is null or cv.organization_id = p_organization_id)
    and (p_date_from is null or cv.activated_at >= p_date_from)
    and (p_date_to is null or cv.activated_at <= p_date_to);

  -- Get paginated activations using cardholders_view
  select json_build_object(
    'data', coalesce((
      select json_agg(row_to_json(t))
      from (
        select
          cv.card_id::text as id,
          coalesce(cv.cardholder_name, cv.cardholder_email, 'Unknown User')::text as cardholder_name,
          cv.cardholder_id::text as cardholder_id,
          cv.card_id::text as card_id,
          cv.display_code::text as display_code,
          org.name::text as organization_name,
          cv.activated_at::text as activated_at
        from public.cardholders_view cv
        inner join public.accounts org on org.id = cv.organization_id
        where cv.card_status = 'activated'
          and cv.activated_at is not null
          and (p_organization_id is null or cv.organization_id = p_organization_id)
          and (p_date_from is null or cv.activated_at >= p_date_from)
          and (p_date_to is null or cv.activated_at <= p_date_to)
        order by cv.activated_at desc
        limit p_limit
        offset v_offset
      ) t
    ), '[]'::json),
    'count', v_total_count,
    'page', p_page,
    'limit', p_limit
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_admin_recent_activations(uuid, timestamptz, timestamptz, int, int) to authenticated;

-- 7. Update get_admin_revenue_over_time to support filters
drop function if exists public.get_admin_revenue_over_time(int, uuid, timestamptz, timestamptz);
drop function if exists public.get_admin_revenue_over_time(int);

create function public.get_admin_revenue_over_time(
  months_back int default 6,
  p_organization_id uuid default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table(
  month text,
  revenue bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    to_char(date_trunc('month', c.paid_at), 'Mon YYYY')::text as month,
    coalesce(sum(c.price_cents), 0)::bigint as revenue
  from public.cards c
  where c.status in ('paid', 'activated', 'expired')
    and c.paid_at is not null
    and c.paid_at >= date_trunc('month', now() - (months_back || ' months')::interval)
    and (p_organization_id is null or c.organization_id = p_organization_id)
    and (p_date_from is null or c.paid_at >= p_date_from)
    and (p_date_to is null or c.paid_at <= p_date_to)
  group by date_trunc('month', c.paid_at)
  order by date_trunc('month', c.paid_at) asc;
$$;

grant execute on function public.get_admin_revenue_over_time(int, uuid, timestamptz, timestamptz) to authenticated;

-- 8. Update get_admin_top_organizations to support filters
drop function if exists public.get_admin_top_organizations(int, timestamptz, timestamptz);
drop function if exists public.get_admin_top_organizations(int);

create function public.get_admin_top_organizations(
  limit_count int default 5,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table(
  name text,
  total_revenue bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    a.name::text as name,
    coalesce(sum(c.price_cents), 0)::bigint as total_revenue
  from public.accounts a
  left join public.cards c on c.organization_id = a.id
    and c.status in ('paid', 'activated', 'expired')
    and (p_date_from is null or c.paid_at >= p_date_from)
    and (p_date_to is null or c.paid_at <= p_date_to)
  where a.is_personal_account = false
    and a.name is not null
  group by a.id, a.name
  order by coalesce(sum(c.price_cents), 0) desc
  limit limit_count;
$$;

grant execute on function public.get_admin_top_organizations(int, timestamptz, timestamptz) to authenticated;

-- 9. Update get_admin_platform_stats with active status checks and proper joins
drop function if exists public.get_admin_platform_stats(uuid);
drop function if exists public.get_admin_platform_stats();

create function public.get_admin_platform_stats(
  p_organization_id uuid default null
)
returns json
language sql
security definer
set search_path = ''
as $$
  select json_build_object(
    'active_organizations', (
      select count(distinct a.id)
      from public.accounts a
      inner join public.organization_profiles op on op.account_id = a.id
      where a.is_personal_account = false
        and op.is_active = true
        and exists (
          select 1
          from public.cards c
          where c.organization_id = a.id
            and c.status = 'activated'
        )
        and (p_organization_id is null or a.id = p_organization_id)
    ),
    'active_merchants', (
      select count(distinct mp.id)
      from public.merchant_profiles mp
      where mp.is_active = true
        and (
          p_organization_id is null
          or exists (
            select 1
            from public.redemptions r
            inner join public.cards c on c.id = r.card_id
            where r.merchant_id = mp.account_id
              and c.organization_id = p_organization_id
          )
        )
    ),
    'total_cardholders', (
      select count(distinct c.cardholder_id)
      from public.cards c
      where c.cardholder_id is not null
        and (p_organization_id is null or c.organization_id = p_organization_id)
    )
  );
$$;

grant execute on function public.get_admin_platform_stats(uuid) to authenticated;
