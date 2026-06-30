/*
 * Migration: City-Based Discounts
 *
 * Simplifies discount model by removing organization_id dependency.
 * Discount visibility is now based purely on city matching:
 * cardholder's org city = discount's merchant city
 *
 * BACKWARD COMPATIBLE: Also supports legacy organization_id matching
 * for discounts that still have organization_id set.
 */

-- ============================================================
-- SECTION 1: Make organization_id nullable (deprecation step)
-- ============================================================

ALTER TABLE public.discounts
ALTER COLUMN organization_id DROP NOT NULL;

-- ============================================================
-- SECTION 2: Backfill cities for existing data
-- ============================================================

-- Set default city for existing organizations without city
UPDATE public.organization_profiles
SET city = 'Miami'
WHERE city IS NULL;

-- Set default city for existing merchants without city
UPDATE public.merchant_profiles
SET city = 'Miami'
WHERE city IS NULL;

-- ============================================================
-- SECTION 3: Update RLS Policies for City-Based Filtering
-- ============================================================

-- Drop existing cardholder policy
DROP POLICY IF EXISTS discounts_cardholder_read ON public.discounts;

-- New city-based policy with backward compatibility:
-- Cardholders see discounts if:
--   1. City matching: org.city = merchant.city (new model)
--   2. OR Legacy: discount.organization_id = card.organization_id (old model)
CREATE POLICY discounts_cardholder_read
ON public.discounts
FOR SELECT
TO authenticated
USING (
  is_active = true AND
  valid_from <= now() AND
  (valid_until IS NULL OR valid_until > now()) AND
  EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.organization_profiles op ON op.account_id = c.organization_id
    JOIN public.merchant_profiles mp ON mp.account_id = discounts.merchant_id
    WHERE c.cardholder_id = public.get_user_personal_account_id()
      AND c.status = 'activated'
      AND (
        -- New city-based matching
        (op.city IS NOT NULL AND mp.city IS NOT NULL AND LOWER(op.city) = LOWER(mp.city))
        OR
        -- Legacy organization_id matching (backward compatibility)
        (discounts.organization_id IS NOT NULL AND discounts.organization_id = c.organization_id)
      )
  )
);

COMMENT ON POLICY discounts_cardholder_read ON public.discounts IS
  'Cardholders see active discounts via city matching or legacy org_id matching';

-- Drop existing organization admin policy
DROP POLICY IF EXISTS discounts_organization_read ON public.discounts;

-- Org admins see discounts from merchants in their city (with backward compatibility)
CREATE POLICY discounts_organization_read
ON public.discounts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_profiles op
    JOIN public.merchant_profiles mp ON mp.account_id = discounts.merchant_id
    WHERE public.has_role_on_account(op.account_id, 'org_admin')
      AND (
        -- New city-based matching
        (op.city IS NOT NULL AND mp.city IS NOT NULL AND LOWER(op.city) = LOWER(mp.city))
        OR
        -- Legacy organization_id matching (backward compatibility)
        (discounts.organization_id IS NOT NULL AND discounts.organization_id = op.account_id)
      )
  )
);

COMMENT ON POLICY discounts_organization_read ON public.discounts IS
  'Org admins can view discounts via city matching or legacy org_id matching';
