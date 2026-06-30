/*
 * Migration: Add cardholder profile fields
 * Adds first_name, last_name, and phone to cardholder_profiles table
 * for the Account Settings page.
 */

-- Add columns to cardholder_profiles
ALTER TABLE public.cardholder_profiles
ADD COLUMN IF NOT EXISTS first_name varchar(100),
ADD COLUMN IF NOT EXISTS last_name varchar(100),
ADD COLUMN IF NOT EXISTS phone varchar(50);

-- Add comments for documentation
COMMENT ON COLUMN public.cardholder_profiles.first_name IS 'Cardholder first name';
COMMENT ON COLUMN public.cardholder_profiles.last_name IS 'Cardholder last name';
COMMENT ON COLUMN public.cardholder_profiles.phone IS 'Cardholder phone number';

-- Index for name searches (optional, for future admin search functionality)
CREATE INDEX IF NOT EXISTS ix_cardholder_profiles_name
ON public.cardholder_profiles (last_name, first_name)
WHERE last_name IS NOT NULL;
