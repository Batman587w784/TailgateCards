/*
 * Migration: Fix merchant card validation access
 *
 * The card validation flow needs merchants to read any organization's
 * account to lookup cards by card_prefix. The existing RLS policy
 * for authenticated users is too restrictive (only allows reading
 * accounts you're a member of).
 *
 * This adds a policy allowing authenticated users to read accounts
 * that have a card_prefix set (organizations with cards).
 */

-- Allow authenticated users to read accounts by card_prefix for card validation
-- This is needed because merchants need to lookup cards from any organization
CREATE POLICY accounts_read_by_card_prefix_for_validation
  ON public.accounts
  FOR SELECT
  TO authenticated
  USING (card_prefix IS NOT NULL);
