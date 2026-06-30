-- Adds a CHECK constraint enforcing share_per_card_cents <= card_price_cents.
-- Without this, a misconfigured org could earn more than the buyer paid, making
-- the platform fee negative. The Stripe charge fix (using each org's
-- card_price_cents) makes this invariant load-bearing.
--
-- Audits offending rows first and raises with their ids/values, so the migration
-- fails loudly with actionable info instead of an opaque check violation.

do $$
declare
  offenders text;
begin
  select string_agg(
    format('account_id=%s price=%s share=%s', account_id, card_price_cents, share_per_card_cents),
    e'\n'
  )
  into offenders
  from public.organization_profiles
  where share_per_card_cents > card_price_cents;

  if offenders is not null then
    raise exception
      'Cannot add organization_profiles_share_lte_price: % offending rows. Fix these first:%s%s',
      (select count(*) from public.organization_profiles where share_per_card_cents > card_price_cents),
      e'\n',
      offenders;
  end if;
end $$;

alter table public.organization_profiles
  add constraint organization_profiles_share_lte_price
  check (share_per_card_cents <= card_price_cents);

comment on constraint organization_profiles_share_lte_price on public.organization_profiles is
  'An org cannot earn more per card than the buyer pays; platform fee = card_price_cents - share_per_card_cents must be >= 0.';
