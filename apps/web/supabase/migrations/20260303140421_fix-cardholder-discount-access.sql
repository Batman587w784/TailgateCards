/*
 * Migration: Fix Cardholder Discount Access
 *
 * Two root causes prevent cardholders from viewing discounts:
 *
 * 1. The partnership migration (20260124130645) replaced city-based matching
 *    with partnership-only matching, but many org-merchant pairs have no
 *    explicit partnership record. This migration re-adds city-based matching
 *    as a fallback alongside partnerships.
 *
 * 2. The accounts_merchant_public_picture_read and accounts_cardholder_view_org
 *    policies may be missing from production if the DB was rebuilt from schemas.
 *    This migration idempotently ensures they exist.
 */

-- ============================================================
-- SECTION 1: Fix Discount RLS — Add City-Based Fallback
-- ============================================================

-- Drop and recreate cardholder policy with city fallback
DROP POLICY IF EXISTS discounts_cardholder_read ON public.discounts;

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
    WHERE c.cardholder_id = public.get_user_personal_account_id()
      AND c.status = 'activated'
      AND (
        -- 1. Explicit partnership
        EXISTS (
          SELECT 1 FROM public.organization_merchant_partnerships omp
          WHERE omp.organization_id = c.organization_id
            AND omp.merchant_id = discounts.merchant_id
        )
        OR
        -- 2. City-based matching (fallback)
        EXISTS (
          SELECT 1
          FROM public.organization_profiles op
          JOIN public.merchant_profiles mp ON mp.account_id = discounts.merchant_id
          WHERE op.account_id = c.organization_id
            AND op.city IS NOT NULL AND mp.city IS NOT NULL
            AND LOWER(op.city) = LOWER(mp.city)
        )
        OR
        -- 3. Legacy org_id matching
        (discounts.organization_id IS NOT NULL AND discounts.organization_id = c.organization_id)
      )
  )
);

COMMENT ON POLICY discounts_cardholder_read ON public.discounts IS
  'Cardholders see active discounts via partnership, city matching, or legacy org_id';

-- Drop and recreate organization admin policy with city fallback
DROP POLICY IF EXISTS discounts_organization_read ON public.discounts;

CREATE POLICY discounts_organization_read
ON public.discounts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_profiles op
    WHERE public.has_role_on_account(op.account_id, 'org_admin')
      AND (
        -- 1. Explicit partnership
        EXISTS (
          SELECT 1 FROM public.organization_merchant_partnerships omp
          WHERE omp.organization_id = op.account_id
            AND omp.merchant_id = discounts.merchant_id
        )
        OR
        -- 2. City-based matching (fallback)
        EXISTS (
          SELECT 1
          FROM public.merchant_profiles mp
          WHERE mp.account_id = discounts.merchant_id
            AND op.city IS NOT NULL AND mp.city IS NOT NULL
            AND LOWER(op.city) = LOWER(mp.city)
        )
        OR
        -- 3. Legacy org_id matching
        (discounts.organization_id IS NOT NULL AND discounts.organization_id = op.account_id)
      )
  )
);

COMMENT ON POLICY discounts_organization_read ON public.discounts IS
  'Org admins see discounts via partnership, city matching, or legacy org_id';

-- Functional indexes for case-insensitive city comparison in RLS policies
CREATE INDEX IF NOT EXISTS ix_organization_profiles_city_lower
  ON public.organization_profiles (LOWER(city)) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_merchant_profiles_city_lower
  ON public.merchant_profiles (LOWER(city)) WHERE city IS NOT NULL;

-- ============================================================
-- SECTION 2: Security Definer Helpers for Account Policies
-- (Break circular RLS evaluation that causes stack depth errors)
-- ============================================================

-- Check if an account has a merchant_profiles row (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_merchant_account(target_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_profiles WHERE account_id = target_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_merchant_account(uuid) TO authenticated;

-- Check if user has a card from an organization (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_card_organization(target_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cards
    WHERE cardholder_id = public.get_user_personal_account_id()
      AND organization_id = target_org_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_card_organization(uuid) TO authenticated;

-- ============================================================
-- SECTION 3: Ensure Account Policies Exist (Idempotent)
-- Uses SECURITY DEFINER helpers to avoid circular RLS
-- ============================================================

-- Merchant public picture read — allows cardholders to see merchant logos
DROP POLICY IF EXISTS accounts_merchant_public_picture_read ON public.accounts;

CREATE POLICY accounts_merchant_public_picture_read
ON public.accounts
FOR SELECT
TO authenticated
USING (public.is_merchant_account(id));

-- Cardholder view org — allows cardholders to see org accounts for their cards
DROP POLICY IF EXISTS accounts_cardholder_view_org ON public.accounts;

CREATE POLICY accounts_cardholder_view_org
ON public.accounts
FOR SELECT
TO authenticated
USING (public.is_card_organization(id));
