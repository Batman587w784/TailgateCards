/*
 * -------------------------------------------------------
 * Migration: Fix Cardholder Discount Access
 *
 * Per PRD: Cardholders can only browse discounts AFTER
 * activating an NFC card. Previously, any authenticated
 * user could see discounts.
 *
 * A user becomes a cardholder when a card is activated
 * and linked to them (cardholder_id is set).
 * -------------------------------------------------------
 */

-- Drop the overly permissive public read policy
drop policy if exists discounts_public_read on public.discounts;

-- Create new policy: Only cardholders (users with cards) can view discounts
create policy discounts_cardholder_read
  on public.discounts
  for select
  to authenticated
  using (
    -- Active discounts within validity period
    is_active = true and
    valid_from <= now() and
    (valid_until is null or valid_until > now()) and
    -- User must be a cardholder (have at least one card linked to them)
    exists (
      select 1 from public.cards c
      where c.cardholder_id = public.get_user_personal_account_id()
    )
  );

comment on policy discounts_cardholder_read on public.discounts is
  'Only cardholders (users with at least one card) can view active discounts';
