-- ─────────────────────────────────────────────────────────────────────────────
-- Item 5b / ledger #21 — district cause dashboard.
--
-- Per-org breakdown for a district admin: cards sold (paid+activated, ledger
-- #13) and the amount raised FOR THE CAUSE (cards_sold × the org's per-org
-- nonprofit_cents_per_card). Also returns the raw nonprofit rate so the admin
-- can edit it inline. The district-level goal comes from
-- get_campus_leaderboard_summary (already net).
--
-- Guarded: only the district's own admin (or a super-admin) sees the breakdown
-- — this is per-org financial data, unlike the public campus leaderboard.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_district_cause_dashboard(p_district_id uuid)
returns table (
  org_account_id uuid,
  organization_name text,
  cards_sold bigint,
  nonprofit_cents_per_card integer,
  cause_raised_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Scope guard: caller must administer this district (or be super-admin).
  if public.get_user_district_id() is distinct from p_district_id
     and not public.is_super_admin() then
    return;
  end if;

  return query
    select
      op.account_id as org_account_id,
      coalesce(op.organization_name, a.name)::text as organization_name,
      count(*) filter (where c.status in ('paid', 'activated')) as cards_sold,
      coalesce(op.nonprofit_cents_per_card, 0) as nonprofit_cents_per_card,
      (count(*) filter (where c.status in ('paid', 'activated'))
        * coalesce(op.nonprofit_cents_per_card, 0))::bigint as cause_raised_cents
    from public.organization_profiles op
    join public.accounts a on a.id = op.account_id
    left join public.cards c on c.organization_id = op.account_id
    where op.district_id = p_district_id and op.is_active
    group by op.account_id, op.organization_name, a.name, op.nonprofit_cents_per_card
    order by cause_raised_cents desc, organization_name asc;
end;
$$;

grant execute on function public.get_district_cause_dashboard(uuid) to authenticated;
