/*
 * Migration: Organization-Merchant Partnerships
 *
 * Adds explicit many-to-many relationship between organizations and merchants.
 * Cardholders see discounts from:
 *   1. Partnered merchants (explicit partnership)
 *   2. OR City-matched merchants (fallback for backward compatibility)
 *
 * Also auto-creates partnerships from existing city matches.
 */

-- ============================================================
-- SECTION 1: Create Junction Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organization_merchant_partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(organization_id, merchant_id)
);

COMMENT ON TABLE public.organization_merchant_partnerships IS
  'Many-to-many relationship between organizations and their merchant partners';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_omp_organization_id ON public.organization_merchant_partnerships(organization_id);
CREATE INDEX IF NOT EXISTS idx_omp_merchant_id ON public.organization_merchant_partnerships(merchant_id);

-- Enable RLS
ALTER TABLE public.organization_merchant_partnerships ENABLE ROW LEVEL SECURITY;

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_merchant_partnerships
  TO authenticated, service_role;

-- ============================================================
-- SECTION 2: RLS Policies for Partnerships Table
-- ============================================================

-- Super-admins have full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_merchant_partnerships' AND policyname = 'omp_super_admin_all'
  ) THEN
    CREATE POLICY omp_super_admin_all
    ON public.organization_merchant_partnerships
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());
  END IF;
END $$;

-- Organizations can read their own partnerships
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_merchant_partnerships' AND policyname = 'omp_organization_read'
  ) THEN
    CREATE POLICY omp_organization_read
    ON public.organization_merchant_partnerships
    FOR SELECT
    TO authenticated
    USING (
      public.has_role_on_account(organization_id, 'org_admin')
    );
  END IF;
END $$;

-- Merchants can read partnerships they're part of
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_merchant_partnerships' AND policyname = 'omp_merchant_read'
  ) THEN
    CREATE POLICY omp_merchant_read
    ON public.organization_merchant_partnerships
    FOR SELECT
    TO authenticated
    USING (
      public.has_role_on_account(merchant_id)
    );
  END IF;
END $$;

-- Cardholders can read partnerships for their organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_merchant_partnerships' AND policyname = 'omp_cardholder_read'
  ) THEN
    CREATE POLICY omp_cardholder_read
    ON public.organization_merchant_partnerships
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.cards c
        WHERE c.cardholder_id = public.get_user_personal_account_id()
          AND c.status = 'activated'
          AND c.organization_id = organization_merchant_partnerships.organization_id
      )
    );
  END IF;
END $$;

-- ============================================================
-- SECTION 3: Update Discounts RLS Policy (Partnership-based only)
-- ============================================================

-- Drop existing cardholder policy
DROP POLICY IF EXISTS discounts_cardholder_read ON public.discounts;

-- New policy: Partnership-based matching only
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
        -- Partnership-based matching
        EXISTS (
          SELECT 1 FROM public.organization_merchant_partnerships omp
          WHERE omp.organization_id = c.organization_id
            AND omp.merchant_id = discounts.merchant_id
        )
        OR
        -- Legacy: organization_id matching (backward compatibility)
        (discounts.organization_id IS NOT NULL AND discounts.organization_id = c.organization_id)
      )
  )
);

COMMENT ON POLICY discounts_cardholder_read ON public.discounts IS
  'Cardholders see active discounts via explicit partnership or legacy org_id matching';

-- Drop existing organization admin policy
DROP POLICY IF EXISTS discounts_organization_read ON public.discounts;

-- Org admins see discounts from partnered merchants only
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
        -- Partnership-based matching
        EXISTS (
          SELECT 1 FROM public.organization_merchant_partnerships omp
          WHERE omp.organization_id = op.account_id
            AND omp.merchant_id = discounts.merchant_id
        )
        OR
        -- Legacy: organization_id matching (backward compatibility)
        (discounts.organization_id IS NOT NULL AND discounts.organization_id = op.account_id)
      )
  )
);

COMMENT ON POLICY discounts_organization_read ON public.discounts IS
  'Org admins can view discounts via explicit partnership or legacy org_id matching';

-- ============================================================
-- SECTION 4: Auto-Create Partnerships from Existing City Matches
-- ============================================================

INSERT INTO public.organization_merchant_partnerships (organization_id, merchant_id)
SELECT DISTINCT op.account_id, mp.account_id
FROM public.organization_profiles op
JOIN public.merchant_profiles mp
  ON LOWER(op.city) = LOWER(mp.city)
WHERE op.city IS NOT NULL
  AND mp.city IS NOT NULL
  AND op.account_id IS NOT NULL
  AND mp.account_id IS NOT NULL
ON CONFLICT (organization_id, merchant_id) DO NOTHING;

-- ============================================================
-- SECTION 5: Helper Functions
-- ============================================================

-- Get merchant partners for an organization
CREATE OR REPLACE FUNCTION public.get_organization_merchant_partners(org_id uuid)
RETURNS TABLE(merchant_id uuid) AS $$
  SELECT omp.merchant_id
  FROM public.organization_merchant_partnerships omp
  WHERE omp.organization_id = org_id;
$$ LANGUAGE sql STABLE SECURITY INVOKER;

COMMENT ON FUNCTION public.get_organization_merchant_partners IS
  'Returns all merchant IDs partnered with the given organization';

-- Get organization partners for a merchant
CREATE OR REPLACE FUNCTION public.get_merchant_organization_partners(merch_id uuid)
RETURNS TABLE(organization_id uuid) AS $$
  SELECT omp.organization_id
  FROM public.organization_merchant_partnerships omp
  WHERE omp.merchant_id = merch_id;
$$ LANGUAGE sql STABLE SECURITY INVOKER;

COMMENT ON FUNCTION public.get_merchant_organization_partners IS
  'Returns all organization IDs partnered with the given merchant';
