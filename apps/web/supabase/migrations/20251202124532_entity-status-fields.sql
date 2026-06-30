/*
 * -------------------------------------------------------
 * Migration: Entity Status Fields
 *
 * Adds is_active status fields and computed aggregation functions
 * for the super admin entity management tables.
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Add is_active to organization_profiles
-- ============================================================

ALTER TABLE public.organization_profiles
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organization_profiles.is_active IS 'Whether the organization is active/enabled';

-- ============================================================
-- SECTION 2: Add is_active and contact fields to merchant_profiles
-- ============================================================

ALTER TABLE public.merchant_profiles
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.merchant_profiles
ADD COLUMN IF NOT EXISTS primary_contact_name varchar(255);

ALTER TABLE public.merchant_profiles
ADD COLUMN IF NOT EXISTS primary_contact_email varchar(320);

COMMENT ON COLUMN public.merchant_profiles.is_active IS 'Whether the merchant is active/enabled';
COMMENT ON COLUMN public.merchant_profiles.primary_contact_name IS 'Name of the primary contact person';
COMMENT ON COLUMN public.merchant_profiles.primary_contact_email IS 'Email of the primary contact person';

-- ============================================================
-- SECTION 3: Add is_active and phone to accounts (for distributors)
-- ============================================================

ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS phone varchar(50);

COMMENT ON COLUMN public.accounts.is_active IS 'Whether the account is active/enabled (used for distributors)';
COMMENT ON COLUMN public.accounts.phone IS 'Phone number for the account (used for distributors)';

-- ============================================================
-- SECTION 4: Aggregation Functions for Computed Columns
-- ============================================================

-- Organization total revenue (sum of card payments in cents)
CREATE OR REPLACE FUNCTION public.get_organization_total_revenue(org_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(price_cents), 0)::bigint
  FROM public.cards
  WHERE organization_id = org_account_id
    AND status IN ('paid', 'activated', 'expired');
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_total_revenue(uuid) TO authenticated, service_role;

-- Merchant total redemptions count
CREATE OR REPLACE FUNCTION public.get_merchant_total_redemptions(merchant_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COUNT(*)::bigint
  FROM public.redemptions
  WHERE merchant_id = merchant_account_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_merchant_total_redemptions(uuid) TO authenticated, service_role;

-- Merchant active discounts count
CREATE OR REPLACE FUNCTION public.get_merchant_active_discounts(merchant_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COUNT(*)::bigint
  FROM public.discounts
  WHERE merchant_id = merchant_account_id
    AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_merchant_active_discounts(uuid) TO authenticated, service_role;

-- Distributor total sales (count of cards sold)
CREATE OR REPLACE FUNCTION public.get_distributor_total_sales(distributor_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COUNT(*)::bigint
  FROM public.cards
  WHERE distributor_id = distributor_account_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_total_sales(uuid) TO authenticated, service_role;

-- Distributor's organization name (from team membership)
CREATE OR REPLACE FUNCTION public.get_distributor_organization_name(distributor_account_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT op.organization_name
  FROM public.accounts_memberships am
  INNER JOIN public.organization_profiles op ON op.account_id = am.account_id
  WHERE am.user_id = (
    SELECT primary_owner_user_id
    FROM public.accounts
    WHERE id = distributor_account_id
  )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_organization_name(uuid) TO authenticated, service_role;

-- Cardholder total redemptions
CREATE OR REPLACE FUNCTION public.get_cardholder_total_redemptions(cardholder_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COUNT(r.id)::bigint
  FROM public.cards c
  LEFT JOIN public.redemptions r ON r.card_id = c.id
  WHERE c.cardholder_id = cardholder_account_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_cardholder_total_redemptions(uuid) TO authenticated, service_role;

-- Cardholder last used date
CREATE OR REPLACE FUNCTION public.get_cardholder_last_used(cardholder_account_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT MAX(r.redeemed_at)
  FROM public.cards c
  LEFT JOIN public.redemptions r ON r.card_id = c.id
  WHERE c.cardholder_id = cardholder_account_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_cardholder_last_used(uuid) TO authenticated, service_role;

-- ============================================================
-- SECTION 5: Indexes for Performance
-- ============================================================

-- Index for is_active lookups on organization_profiles
CREATE INDEX IF NOT EXISTS ix_organization_profiles_is_active
  ON public.organization_profiles (is_active);

-- Index for is_active lookups on merchant_profiles
CREATE INDEX IF NOT EXISTS ix_merchant_profiles_is_active
  ON public.merchant_profiles (is_active);

-- Index for is_active lookups on accounts (for distributors)
CREATE INDEX IF NOT EXISTS ix_accounts_is_active
  ON public.accounts (is_active)
  WHERE is_personal_account = true;

-- ============================================================
-- SECTION 6: RLS Policies for Super Admin Updates
-- ============================================================

-- Super admins can update organization profiles (for status toggle)
CREATE POLICY super_admins_update_organization_profiles
  ON public.organization_profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Super admins can update merchant profiles (for status toggle)
CREATE POLICY super_admins_update_merchant_profiles
  ON public.merchant_profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Super admins can update accounts (for distributor status toggle)
CREATE POLICY super_admins_update_accounts
  ON public.accounts
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
