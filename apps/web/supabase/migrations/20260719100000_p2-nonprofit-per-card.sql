-- ─────────────────────────────────────────────────────────────────────────────
-- Item 5 / ledger #21 — per-org "nonprofit amount per card".
--
-- The amount that actually reaches the named nonprofit, per card. Set at the
-- district level, configurable per org (it varies by campaign). Only meaningful
-- for orgs under a campus-flagged district (where the nonprofit is the headline).
-- NULL = not configured yet (treated as 0 — never overstate the nonprofit cut,
-- the one rule retained from ledger #12).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.organization_profiles
  add column if not exists nonprofit_cents_per_card integer;

comment on column public.organization_profiles.nonprofit_cents_per_card is
  'Net cents to the named nonprofit per card, for orgs under a campus-flagged district (ledger #21). Set by district_admin per org. NULL/0 = not configured.';

-- ─────────────────────────────────────────────────────────────────────────────
-- org_net_cents_per_card — the effective net-per-card rate for goal bars and
-- leaderboards (ledger #20). The goal bar shows money that actually reaches the
-- entity named in the headline:
--   campus-flagged district (headline = the nonprofit) -> per-org nonprofit amount
--   otherwise (headline = the org)                     -> org's share_per_card_cents
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.org_net_cents_per_card(p_org_account_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when d.district_type::text = 'campus'
      then coalesce(op.nonprofit_cents_per_card, 0)
    else coalesce(op.share_per_card_cents, 0)
  end
  from public.organization_profiles op
  left join public.districts d on d.id = op.district_id
  where op.account_id = p_org_account_id;
$$;

grant execute on function public.org_net_cents_per_card(uuid)
  to anon, authenticated, service_role;
