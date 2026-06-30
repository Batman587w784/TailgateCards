/*
 * Migration: Fix Discount RLS Statement Timeout
 *
 * Root cause: The discounts_cardholder_read policy contains nested subqueries
 * across multiple RLS-protected tables (cards → organization_merchant_partnerships
 * → cards again). Each table access triggers its own RLS evaluation, creating an
 * exponentially expensive query that exceeds the statement timeout.
 *
 * Fix: Replace inline subqueries with SECURITY DEFINER helper functions that
 * bypass intermediate RLS, breaking the nested evaluation chain.
 */

-- ============================================================
-- SECTION 1: SECURITY DEFINER helper — check if current user
-- (cardholder) can see a discount from the given merchant.
--
-- Checks (in order):
--   1. Explicit partnership in organization_merchant_partnerships
--   2. City-based matching (org city = merchant city)
--
-- NOTE: The legacy discount.organization_id fallback present in the
-- previous policy has been intentionally dropped. All active discounts
-- in production have organization_id = NULL, so it was dead code.
--
-- Bypasses RLS on cards, organization_merchant_partnerships,
-- organization_profiles, and merchant_profiles to avoid the
-- nested RLS chain that causes timeouts.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cardholder_can_see_merchant(target_merchant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cards c
    WHERE c.cardholder_id = public.get_user_personal_account_id()
      AND c.status = 'activated'
      AND (
        -- 1. Explicit partnership
        EXISTS (
          SELECT 1 FROM public.organization_merchant_partnerships omp
          WHERE omp.organization_id = c.organization_id
            AND omp.merchant_id = target_merchant_id
        )
        OR
        -- 2. City-based matching (fallback)
        EXISTS (
          SELECT 1
          FROM public.organization_profiles op
          JOIN public.merchant_profiles mp ON mp.account_id = target_merchant_id
          WHERE op.account_id = c.organization_id
            AND op.city IS NOT NULL AND mp.city IS NOT NULL
            AND LOWER(op.city) = LOWER(mp.city)
        )
      )
  );
$$;

COMMENT ON FUNCTION public.cardholder_can_see_merchant(uuid) IS
  'SECURITY DEFINER: checks if current cardholder has access to a merchant via partnership or city match. Bypasses nested RLS.';

GRANT EXECUTE ON FUNCTION public.cardholder_can_see_merchant(uuid) TO authenticated;

-- ============================================================
-- SECTION 2: SECURITY DEFINER helper — check if an org admin
-- can see a discount from the given merchant.
-- ============================================================

CREATE OR REPLACE FUNCTION public.org_admin_can_see_merchant(target_merchant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_profiles op
    WHERE public.has_role_on_account(op.account_id, 'org_admin')
      AND (
        -- 1. Explicit partnership
        EXISTS (
          SELECT 1 FROM public.organization_merchant_partnerships omp
          WHERE omp.organization_id = op.account_id
            AND omp.merchant_id = target_merchant_id
        )
        OR
        -- 2. City-based matching (fallback)
        EXISTS (
          SELECT 1
          FROM public.merchant_profiles mp
          WHERE mp.account_id = target_merchant_id
            AND op.city IS NOT NULL AND mp.city IS NOT NULL
            AND LOWER(op.city) = LOWER(mp.city)
        )
      )
  );
$$;

COMMENT ON FUNCTION public.org_admin_can_see_merchant(uuid) IS
  'SECURITY DEFINER: checks if current org admin has access to a merchant via partnership or city match. Bypasses nested RLS.';

GRANT EXECUTE ON FUNCTION public.org_admin_can_see_merchant(uuid) TO authenticated;

-- ============================================================
-- SECTION 3: Replace discounts RLS policies to use the helpers
--
-- Wrapped in a transaction so that there is no window between
-- DROP and CREATE where concurrent reads would see no policy
-- and silently return zero rows.
-- ============================================================

BEGIN;

-- Cardholder policy
DROP POLICY IF EXISTS discounts_cardholder_read ON public.discounts;

CREATE POLICY discounts_cardholder_read
ON public.discounts
FOR SELECT
TO authenticated
USING (
  is_active = true AND
  valid_from <= now() AND
  (valid_until IS NULL OR valid_until > now()) AND
  public.cardholder_can_see_merchant(merchant_id)
);

COMMENT ON POLICY discounts_cardholder_read ON public.discounts IS
  'Cardholders see active discounts via SECURITY DEFINER helper (partnership or city match)';

-- Organization admin policy
DROP POLICY IF EXISTS discounts_organization_read ON public.discounts;

CREATE POLICY discounts_organization_read
ON public.discounts
FOR SELECT
TO authenticated
USING (
  public.org_admin_can_see_merchant(merchant_id)
);

COMMENT ON POLICY discounts_organization_read ON public.discounts IS
  'Org admins see discounts via SECURITY DEFINER helper (partnership or city match)';

COMMIT;
