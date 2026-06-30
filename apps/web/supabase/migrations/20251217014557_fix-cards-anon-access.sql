/*
 * Migration: Fix cards table access for anonymous users
 *
 * The card activation flow (/activate?code=...) needs to work for
 * unauthenticated users who scan QR codes. The previous policy only
 * allowed 'authenticated' role, blocking anonymous access.
 *
 * This migration:
 * 1. Grants USAGE on public schema to anon role
 * 2. Drops the existing authenticated-only policy
 * 3. Creates a new policy allowing both anon and authenticated to read cards
 * 4. Also allows anon to read accounts (for card_prefix lookup)
 */

-- Grant USAGE on public schema to anon (required for any table access)
GRANT USAGE ON SCHEMA public TO anon;

-- Drop the existing policy that only allows authenticated
DROP POLICY IF EXISTS cards_public_read_by_code ON public.cards;

-- Create new policy allowing both anon and authenticated to read cards
-- This is needed for the /activate page to load card data before user signs up
CREATE POLICY cards_public_read_for_activation
  ON public.cards
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Grant select permission to anon role on cards table
GRANT SELECT ON public.cards TO anon;

-- Also need to allow anon to read accounts for card_prefix lookup
-- Create a limited policy for reading accounts by card_prefix
CREATE POLICY accounts_public_read_by_card_prefix
  ON public.accounts
  FOR SELECT
  TO anon
  USING (card_prefix IS NOT NULL);

-- Grant select on accounts to anon (limited by RLS policy above)
GRANT SELECT ON public.accounts TO anon;

-- Allow anon to read organization_profiles for card pricing
CREATE POLICY org_profiles_public_read_card_price
  ON public.organization_profiles
  FOR SELECT
  TO anon
  USING (true);

GRANT SELECT ON public.organization_profiles TO anon;
