-- Migration: Add plain text passcode for merchant dashboard access
-- This allows super admins to view and refresh the passcode

-- Add plain text passcode column (4-char alphanumeric uppercase)
ALTER TABLE public.merchant_profiles
ADD COLUMN IF NOT EXISTS passcode VARCHAR(4);

-- Add constraint for format validation
ALTER TABLE public.merchant_profiles
ADD CONSTRAINT passcode_format CHECK (
  passcode IS NULL OR passcode ~ '^[A-Z0-9]{4}$'
);

-- Comment on column
COMMENT ON COLUMN public.merchant_profiles.passcode IS
  '4-character uppercase alphanumeric passcode for protected dashboard pages. Stored in plain text for admin visibility.';

-- Create function to verify passcode (called by merchants)
CREATE OR REPLACE FUNCTION public.verify_merchant_passcode(
  target_account_id uuid,
  input_passcode text
)
RETURNS boolean
SET search_path = ''
AS $$
BEGIN
  -- Verify caller has a role on this merchant account
  IF NOT public.has_role_on_account(target_account_id) THEN
    RETURN false;
  END IF;

  -- Case-insensitive comparison
  RETURN EXISTS (
    SELECT 1 FROM public.merchant_profiles
    WHERE account_id = target_account_id
    AND passcode = UPPER(input_passcode)
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION public.verify_merchant_passcode(uuid, text) TO authenticated;

-- Admin function to set/regenerate passcode (called via service_role)
CREATE OR REPLACE FUNCTION public.admin_set_merchant_passcode(
  target_account_id uuid,
  new_passcode text
)
RETURNS void
SET search_path = ''
SECURITY DEFINER
AS $$
BEGIN
  -- Validate passcode format
  IF new_passcode !~ '^[A-Z0-9]{4}$' THEN
    RAISE EXCEPTION 'Passcode must be 4 uppercase alphanumeric characters';
  END IF;

  UPDATE public.merchant_profiles
  SET passcode = new_passcode
  WHERE account_id = target_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Merchant profile not found for account %', target_account_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Only grant to service_role (admin client)
REVOKE ALL ON FUNCTION public.admin_set_merchant_passcode(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_merchant_passcode(uuid, text) TO service_role;
