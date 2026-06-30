-- Fix Revenue Over Time chart to always show the last 6 months
-- Even if there's no revenue data for a month, it should appear with 0

drop function if exists public.get_admin_revenue_over_time(int, uuid, timestamptz, timestamptz);

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
  with validated_months_back as (
    -- Validate and constrain months_back to 1-120 range
    select least(greatest(months_back, 1), 120) as safe_months_back
  ),
  months as (
    -- Generate all months in the range
    select generate_series(
      date_trunc('month', now() - ((select safe_months_back from validated_months_back) - 1 || ' months')::interval),
      date_trunc('month', now()),
      '1 month'::interval
    )::date as month_date
  ),
  revenue_data as (
    -- Get actual revenue per month
    select
      date_trunc('month', c.paid_at)::date as month_date,
      coalesce(sum(c.price_cents), 0)::bigint as revenue
    from public.cards c
    where c.status in ('paid', 'activated', 'expired')
      and c.paid_at is not null
      and c.paid_at >= date_trunc('month', now() - ((select safe_months_back from validated_months_back) - 1 || ' months')::interval)
      and (p_organization_id is null or c.organization_id = p_organization_id)
      and (p_date_from is null or c.paid_at >= p_date_from)
      and (p_date_to is null or c.paid_at <= p_date_to)
    group by date_trunc('month', c.paid_at)::date
  )
  select
    to_char(m.month_date, 'Mon YYYY')::text as month,
    coalesce(r.revenue, 0)::bigint as revenue
  from months m
  left join revenue_data r on r.month_date = m.month_date
  order by m.month_date asc;
$$;

grant execute on function public.get_admin_revenue_over_time(int, uuid, timestamptz, timestamptz) to authenticated;
