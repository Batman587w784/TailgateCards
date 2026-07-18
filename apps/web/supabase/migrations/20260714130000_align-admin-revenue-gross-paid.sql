-- Migration: align admin revenue helpers to the same gross + paid basis
--
-- get_organization_total_revenue (super-admin Organizations "Total Revenue") and
-- get_district_total_revenue (super-admin Districts "Total Raised") now use the
-- SAME definition as the leaderboard and buy page: GROSS card price x
-- (paid+activated). One definition everywhere, so the same chapter/campus shows
-- one number across the admin Users/Districts columns, the leaderboard, and the
-- purchase page. These are ADMIN-FACING figures.

create or replace function public.get_organization_total_revenue(org_account_id uuid)
returns bigint
language sql
stable
set search_path to ''
as $function$
  select coalesce(
    (
      select count(c.id)
      from public.cards c
      where c.organization_id = org_account_id
        and c.status in ('paid', 'activated')
    ) * (
      select op.card_price_cents
      from public.organization_profiles op
      where op.account_id = org_account_id
    ),
    0
  )::bigint;
$function$;

create or replace function public.get_district_total_revenue(p_district_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $function$
  select coalesce(
    sum(op.card_price_cents) filter (where c.status in ('paid', 'activated')),
    0
  )::bigint
  from public.organization_profiles op
  left join public.cards c on c.organization_id = op.account_id
  where op.district_id = p_district_id;
$function$;
