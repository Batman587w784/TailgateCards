/*
 * -------------------------------------------------------
 * Migration: Consolidate Merchant Roles
 *
 * This migration consolidates merchant_owner and merchant_staff
 * into a single 'merchant' role. Analytics access is controlled
 * by passcode verification, not role-based permissions.
 *
 * Changes:
 * - Rename merchant_owner to merchant
 * - Remove merchant_staff role
 * - Update RLS policies to use 'merchant' role
 * - Update platform_role enum (4 roles instead of 5)
 * -------------------------------------------------------
 */

-- ============================================================
-- Step 1: Update accounts_memberships to use 'merchant' instead of merchant_staff
-- ============================================================

-- First, convert any merchant_staff to merchant_owner (temporary)
UPDATE public.accounts_memberships
SET account_role = 'merchant_owner'
WHERE account_role = 'merchant_staff';

-- ============================================================
-- Step 2: Remove merchant_staff from role_permissions and roles tables
-- ============================================================

DELETE FROM public.role_permissions WHERE role = 'merchant_staff';
DELETE FROM public.roles WHERE name = 'merchant_staff';

-- ============================================================
-- Step 3: Replace merchant_owner with merchant
-- ============================================================

-- Strategy: INSERT new role first, then update references, then delete old role
-- This avoids FK constraint violations
-- Note: hierarchy_level has unique constraint, so we use a temp value first

-- 3a. Insert new 'merchant' role with temporary hierarchy_level (100)
INSERT INTO public.roles (name, hierarchy_level)
VALUES ('merchant', 100);

-- 3b. Copy permissions from merchant_owner to merchant
-- Reset sequence to avoid id conflicts (in case sequence is out of sync with data)
SELECT setval(
  pg_get_serial_sequence('public.role_permissions', 'id'),
  COALESCE((SELECT MAX(id) FROM public.role_permissions), 0) + 1,
  false
);

INSERT INTO public.role_permissions (role, permission)
SELECT 'merchant', permission
FROM public.role_permissions
WHERE role = 'merchant_owner';

-- 3c. Update accounts_memberships to use new 'merchant' role (now exists)
UPDATE public.accounts_memberships
SET account_role = 'merchant'
WHERE account_role = 'merchant_owner';

-- 3d. Get the original hierarchy_level from merchant_owner before deleting
-- 3e. Delete old merchant_owner permissions and role
DELETE FROM public.role_permissions WHERE role = 'merchant_owner';
DELETE FROM public.roles WHERE name = 'merchant_owner';

-- 3f. Update merchant to use the correct hierarchy_level (3, previously used by merchant_owner)
UPDATE public.roles SET hierarchy_level = 3 WHERE name = 'merchant';

-- ============================================================
-- Step 4: Recreate platform_role enum with 4 roles
-- ============================================================

-- Drop functions that depend on the old enum type
DROP FUNCTION IF EXISTS public.get_platform_role();
DROP FUNCTION IF EXISTS public.has_platform_role(public.platform_role);

-- Create new enum type
CREATE TYPE public.platform_role_new AS ENUM (
  'cardholder',
  'org_admin',
  'distributor',
  'merchant'
);

-- Drop old enum type and rename new one
DROP TYPE public.platform_role;
ALTER TYPE public.platform_role_new RENAME TO platform_role;

-- Recreate get_platform_role() with the new enum type
CREATE FUNCTION public.get_platform_role()
RETURNS public.platform_role
SET search_path = ''
AS $$
DECLARE
  role_name text;
BEGIN
  -- Get role from memberships
  role_name := public.get_user_platform_role(auth.uid());

  -- Cast to enum (will return cardholder if not a valid enum value)
  BEGIN
    RETURN role_name::public.platform_role;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN 'cardholder'::public.platform_role;
  END;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION public.get_platform_role() TO authenticated;

-- Recreate has_platform_role() with the new enum type
CREATE FUNCTION public.has_platform_role(target_role public.platform_role)
RETURNS boolean
SET search_path = ''
AS $$
BEGIN
  RETURN public.get_user_platform_role(auth.uid()) = target_role::text;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION public.has_platform_role(public.platform_role) TO authenticated;

-- ============================================================
-- Step 5: Update RLS policies to use 'merchant' role
-- ============================================================

-- Drop and recreate merchant_profiles policies with 'merchant' role

-- Insert policy
DROP POLICY IF EXISTS merchant_profiles_insert ON public.merchant_profiles;
CREATE POLICY merchant_profiles_insert
  ON public.merchant_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id, 'merchant')
  );

-- Update policy
DROP POLICY IF EXISTS merchant_profiles_update ON public.merchant_profiles;
CREATE POLICY merchant_profiles_update
  ON public.merchant_profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_account(account_id, 'merchant')
  )
  WITH CHECK (
    public.has_role_on_account(account_id, 'merchant')
  );

-- Delete policy
DROP POLICY IF EXISTS merchant_profiles_delete ON public.merchant_profiles;
CREATE POLICY merchant_profiles_delete
  ON public.merchant_profiles
  FOR DELETE
  TO authenticated
  USING (
    public.has_role_on_account(account_id, 'merchant')
  );

-- ============================================================
-- Step 6: Update set_merchant_dashboard_passcode to check 'merchant' role
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_merchant_dashboard_passcode(
  target_account_id uuid,
  passcode text
)
RETURNS void
SET search_path = ''
AS $$
BEGIN
  -- Verify caller has merchant role on this account
  IF NOT public.has_role_on_account(target_account_id, 'merchant') THEN
    RAISE EXCEPTION 'Only merchants can set the dashboard passcode';
  END IF;

  UPDATE public.merchant_profiles
  SET dashboard_passcode_hash = extensions.crypt(passcode, extensions.gen_salt('bf'))
  WHERE account_id = target_account_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================================
-- Step 7: Add admin-callable function to set passcode (for auto-generation)
-- ============================================================

-- This function can be called by super admin/service role to set passcode on merchant creation
CREATE OR REPLACE FUNCTION public.admin_set_merchant_dashboard_passcode(
  target_account_id uuid,
  passcode text
)
RETURNS void
SET search_path = ''
SECURITY DEFINER
AS $$
BEGIN
  -- This is a privileged function - only callable by service_role
  -- Used during merchant creation by super admin

  UPDATE public.merchant_profiles
  SET dashboard_passcode_hash = extensions.crypt(passcode, extensions.gen_salt('bf'))
  WHERE account_id = target_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Merchant profile not found for account %', target_account_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Only grant to service_role (used by admin client)
REVOKE ALL ON FUNCTION public.admin_set_merchant_dashboard_passcode(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_merchant_dashboard_passcode(uuid, text) TO service_role;

COMMENT ON FUNCTION public.admin_set_merchant_dashboard_passcode IS
  'Privileged function to set merchant dashboard passcode. Used during merchant creation by super admin.';
