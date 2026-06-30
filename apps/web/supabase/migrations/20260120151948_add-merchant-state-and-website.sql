/*
 * Migration: Add State and Website Columns to Merchant and Organization Profiles
 *
 * Adds state column for geographic filtering and cascading
 * State -> City dropdown functionality in forms.
 * Adds website column for merchant website or social media links.
 */

-- ============================================================
-- SECTION 1: Add state column to merchant_profiles
-- ============================================================

ALTER TABLE public.merchant_profiles
ADD COLUMN IF NOT EXISTS state varchar(100);

COMMENT ON COLUMN public.merchant_profiles.state IS 'US state for geographic filtering';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS ix_merchant_profiles_state
ON public.merchant_profiles (state)
WHERE state IS NOT NULL;

-- ============================================================
-- SECTION 2: Add state column to organization_profiles
-- ============================================================

ALTER TABLE public.organization_profiles
ADD COLUMN IF NOT EXISTS state varchar(100);

COMMENT ON COLUMN public.organization_profiles.state IS 'US state for geographic filtering';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS ix_organization_profiles_state
ON public.organization_profiles (state)
WHERE state IS NOT NULL;

-- ============================================================
-- SECTION 3: Add website column to merchant_profiles
-- ============================================================

ALTER TABLE public.merchant_profiles
ADD COLUMN IF NOT EXISTS website varchar(500);

COMMENT ON COLUMN public.merchant_profiles.website IS 'Website or social media link';
