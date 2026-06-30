/*
 * -------------------------------------------------------
 * Migration: Add Organization to Discounts
 *
 * Discounts now represent a relationship between a merchant
 * AND an organization. This enables org-specific discount
 * visibility for cardholders.
 *
 * Changes:
 * - Add organization_id column to discounts (required)
 * - Add index for organization queries
 * - Add RLS policy for org_admins
 * - Update cardholder RLS to filter by organization
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Add organization_id to discounts table
-- ============================================================

-- Step 1: Add column as nullable first (safe for existing rows)
ALTER TABLE public.discounts
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Step 2: Backfill existing discounts with the single organization's ID
UPDATE public.discounts
SET organization_id = (
  SELECT op.account_id
  FROM public.organization_profiles op
  LIMIT 1
)
WHERE organization_id IS NULL;

-- Step 3: Add NOT NULL constraint
ALTER TABLE public.discounts
ALTER COLUMN organization_id SET NOT NULL;

-- Step 4: Add index for organization queries
CREATE INDEX IF NOT EXISTS ix_discounts_organization_id
ON public.discounts (organization_id);

-- Add comment for documentation
COMMENT ON COLUMN public.discounts.organization_id IS 'Organization this discount is available to';

-- ============================================================
-- SECTION 2: Update RLS Policies
-- ============================================================

-- Add policy for org_admins to view their organization's discounts
CREATE POLICY discounts_organization_read
ON public.discounts
FOR SELECT
TO authenticated
USING (
  public.has_role_on_account(organization_id, 'org_admin')
);

-- Drop old cardholder policy and replace with org-filtered version
DROP POLICY IF EXISTS discounts_cardholder_read ON public.discounts;

CREATE POLICY discounts_cardholder_read
ON public.discounts
FOR SELECT
TO authenticated
USING (
  -- Active discounts within validity period
  is_active = true AND
  valid_from <= now() AND
  (valid_until IS NULL OR valid_until > now()) AND
  -- User must have a card from the same organization as the discount
  EXISTS (
    SELECT 1 FROM public.cards c
    WHERE c.cardholder_id = public.get_user_personal_account_id()
      AND c.organization_id = discounts.organization_id
  )
);

COMMENT ON POLICY discounts_cardholder_read ON public.discounts IS
  'Cardholders can only view active discounts for their card''s organization';
