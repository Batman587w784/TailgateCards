/*
 * Migration: Add City Field to Organization and Merchant Profiles
 *
 * Adds city column for city-based discount filtering.
 * Cardholders will only see discounts from merchants in the same city
 * as their organization.
 */

-- ============================================================
-- SECTION 1: Add city column to organization_profiles
-- ============================================================

ALTER TABLE public.organization_profiles
ADD COLUMN IF NOT EXISTS city varchar(100);

COMMENT ON COLUMN public.organization_profiles.city IS 'City for geographic discount filtering';

CREATE INDEX IF NOT EXISTS ix_organization_profiles_city
ON public.organization_profiles (city)
WHERE city IS NOT NULL;

-- ============================================================
-- SECTION 2: Add city column to merchant_profiles
-- ============================================================

ALTER TABLE public.merchant_profiles
ADD COLUMN IF NOT EXISTS city varchar(100);

COMMENT ON COLUMN public.merchant_profiles.city IS 'City for geographic discount filtering';

CREATE INDEX IF NOT EXISTS ix_merchant_profiles_city
ON public.merchant_profiles (city)
WHERE city IS NOT NULL;

-- ============================================================
-- SECTION 3: Update Cardholder Discount RLS Policy
-- ============================================================

-- Drop the existing cardholder discount policy
DROP POLICY IF EXISTS discounts_cardholder_read ON public.discounts;

-- Create new policy that includes city filtering
-- Cardholders can only see discounts from merchants in the same city as their organization
CREATE POLICY discounts_cardholder_read
ON public.discounts
FOR SELECT
TO authenticated
USING (
  -- Active discounts within validity period
  is_active = true AND
  valid_from <= now() AND
  (valid_until IS NULL OR valid_until > now()) AND
  -- User must have an activated card from an organization that matches the discount's organization
  -- AND the merchant must be in the same city as the organization (or no city filter if org has no city)
  EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.organization_profiles op ON op.account_id = c.organization_id
    JOIN public.merchant_profiles mp ON mp.account_id = discounts.merchant_id
    WHERE c.cardholder_id = public.get_user_personal_account_id()
      AND c.organization_id = discounts.organization_id
      AND c.status = 'activated'
      AND (
        -- City filter: skip if org has no city set (backward compatibility)
        -- Otherwise, both must have city and they must match (case-insensitive)
        op.city IS NULL
        OR (op.city IS NOT NULL AND mp.city IS NOT NULL AND LOWER(op.city) = LOWER(mp.city))
      )
  )
);

COMMENT ON POLICY discounts_cardholder_read ON public.discounts IS
  'Cardholders can only view active discounts for their org where merchant is in same city';
