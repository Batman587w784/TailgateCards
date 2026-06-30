/*
 * Fix redemptions merchant RLS policies (dead roles)
 *
 * redemptions_merchant_insert / redemptions_merchant_update referenced the
 * Makerkit roles 'merchant_owner' / 'merchant_staff', which do not exist in the
 * Tailgate role model (the only merchant role is 'merchant'). Both policies
 * therefore always evaluated false, so no merchant could record a redemption or
 * process a refund through RLS. Rewrite both to use the 'merchant' role.
 *
 * Note: a card may redeem the same discount many times — repeated redemption is
 * a designed feature (see the "used_4_plus_times" heavy-user analytics and the
 * seed's multi-redemption cards). The discounts.max_redemptions_per_card column
 * is vestigial (default 1, never set or enforced). This migration therefore does
 * NOT add any per-(card, discount) uniqueness or redemption-count cap. The live
 * card-status recheck lives at the application layer (recordRedemption).
 */

drop policy if exists redemptions_merchant_insert on public.redemptions;

create policy redemptions_merchant_insert
  on public.redemptions
  for insert
  to authenticated
  with check (
    public.has_role_on_account(merchant_id, 'merchant')
  );

drop policy if exists redemptions_merchant_update on public.redemptions;

create policy redemptions_merchant_update
  on public.redemptions
  for update
  to authenticated
  using (
    public.has_role_on_account(merchant_id, 'merchant')
  )
  with check (
    public.has_role_on_account(merchant_id, 'merchant')
  );
