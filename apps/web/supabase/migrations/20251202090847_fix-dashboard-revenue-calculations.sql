-- Fix dashboard revenue, stats, and activity ordering
-- Issue: Revenue over time shows 0 because paid_at is NULL for activated cards
-- Issue: Transaction stats counts all cards including pending ones
-- Issue: Total cardholders counts users by role, not users who actually have cards
-- Issue: Activities with same timestamp show in wrong order

-- Fix platform stats to count cardholders who actually have cards assigned
create or replace function public.get_admin_platform_stats()
returns json
language sql
security definer
set search_path = ''
as $$
  select json_build_object(
    'active_organizations', (select count(*) from public.organization_profiles),
    'active_merchants', (select count(*) from public.merchant_profiles),
    'total_cardholders', (select count(distinct cardholder_id) from public.cards where cardholder_id is not null)
  );
$$;

-- Fix transaction stats to only count paid/activated/expired cards for revenue
create or replace function public.get_admin_transaction_stats()
returns json
language sql
security definer
set search_path = ''
as $$
  select json_build_object(
    'total_volume_cents', coalesce(
      sum(price_cents) filter (where status in ('paid', 'activated', 'expired')), 0
    ),
    'revenue_generated_cents', coalesce(
      sum(price_cents) filter (where status in ('paid', 'activated', 'expired')), 0
    ),
    'successful_transactions', coalesce(
      count(*) filter (where status in ('paid', 'activated', 'expired')), 0
    ),
    'failed_transactions', coalesce(
      count(*) filter (where status = 'cancelled'), 0
    )
  )
  from public.cards;
$$;

-- Fix revenue over time to use created_at as fallback when paid_at is NULL
create or replace function public.get_admin_revenue_over_time(months_back int default 6)
returns table(month text, revenue bigint)
language sql
security definer
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', now()) - ((months_back - 1) || ' months')::interval,
      date_trunc('month', now()),
      '1 month'::interval
    ) as month_start
  )
  select
    to_char(m.month_start, 'Mon') as month,
    coalesce(sum(c.price_cents), 0)::bigint as revenue
  from months m
  left join public.cards c on
    date_trunc('month', coalesce(c.paid_at, c.created_at)) = m.month_start
    and c.status in ('paid', 'activated', 'expired')
  group by m.month_start
  order by m.month_start;
$$;

-- Add sequence column to activities for deterministic ordering when timestamps are equal
alter table public.activities
add column if not exists seq bigint;

-- Create sequence if not exists
create sequence if not exists public.activities_seq_seq;

-- Set default for seq column
alter table public.activities
alter column seq set default nextval('public.activities_seq_seq');

-- Update existing rows with sequence values based on logical order
-- (organization first, then merchant, then discounts, then redemptions)
with ordered_activities as (
  select id,
    row_number() over (
      order by
        case type
          when 'organization_onboarded' then 1
          when 'merchant_added' then 2
          when 'distributor_added' then 3
          when 'discount_created' then 4
          when 'card_sold' then 5
          when 'card_activated' then 6
          when 'redemption_completed' then 7
          else 8
        end,
        created_at,
        id
    ) as new_seq
  from public.activities
)
update public.activities a
set seq = oa.new_seq
from ordered_activities oa
where a.id = oa.id;

-- Update log_activity to set seq when inserting
create or replace function public.log_activity(
  p_type public.activity_type,
  p_message text,
  p_actor_id uuid default null,
  p_organization_id uuid default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity_id uuid;
begin
  insert into public.activities (
    type,
    message,
    actor_id,
    organization_id,
    entity_type,
    entity_id,
    metadata,
    seq
  ) values (
    p_type,
    p_message,
    p_actor_id,
    p_organization_id,
    p_entity_type,
    p_entity_id,
    p_metadata,
    nextval('public.activities_seq_seq')
  )
  returning id into v_activity_id;

  return v_activity_id;
end;
$$;

-- Update the get_admin_activities function to order by seq desc
create or replace function public.get_admin_activities(
  p_page int default 1,
  p_limit int default 5,
  p_types public.activity_type[] default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offset int;
  v_total int;
  v_data json;
begin
  v_offset := (p_page - 1) * p_limit;

  -- Get total count
  select count(*) into v_total
  from public.activities
  where (p_types is null or type = any(p_types));

  -- Get paginated data ordered by sequence (newest first)
  select json_agg(row_to_json(t)) into v_data
  from (
    select
      id,
      type,
      message,
      actor_id,
      organization_id,
      entity_type,
      entity_id,
      metadata,
      created_at as timestamp
    from public.activities
    where (p_types is null or type = any(p_types))
    order by seq desc
    limit p_limit
    offset v_offset
  ) t;

  return json_build_object(
    'data', coalesce(v_data, '[]'::json),
    'count', v_total,
    'page', p_page,
    'limit', p_limit
  );
end;
$$;
