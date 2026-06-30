/*
 * Migration: Cardholder Organization Profile Access
 *
 * Allows cardholders to view organization profiles for organizations
 * they have cards in. This is required for city-based discount visibility
 * where the RLS policy needs to compare org.city with merchant.city.
 */

-- Allow cardholders to view organization profiles for orgs they have cards in
CREATE POLICY organization_profiles_cardholder_read
ON public.organization_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cards c
    WHERE c.cardholder_id = public.get_user_personal_account_id()
      AND c.organization_id = organization_profiles.account_id
      AND c.status = 'activated'
  )
);

COMMENT ON POLICY organization_profiles_cardholder_read ON public.organization_profiles IS
  'Cardholders can view organization profiles for organizations they have activated cards in';
