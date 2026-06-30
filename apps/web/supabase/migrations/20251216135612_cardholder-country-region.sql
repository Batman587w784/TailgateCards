/*
 * Migration: Add country and region to cardholder_profiles
 * Supports country-region selection during card activation flow
 */

-- Add country column (ISO 3166-1 alpha-2 code, e.g., 'US')
ALTER TABLE public.cardholder_profiles
ADD COLUMN IF NOT EXISTS country varchar(2);

-- Add region column (state/province name or code)
ALTER TABLE public.cardholder_profiles
ADD COLUMN IF NOT EXISTS region varchar(100);

-- Add comments for documentation
COMMENT ON COLUMN public.cardholder_profiles.country IS 'ISO 3166-1 alpha-2 country code (e.g., US)';
COMMENT ON COLUMN public.cardholder_profiles.region IS 'State/province/region name or code';

-- Index for geographic queries (optional, useful for analytics)
CREATE INDEX IF NOT EXISTS ix_cardholder_profiles_country
ON public.cardholder_profiles (country)
WHERE country IS NOT NULL;
