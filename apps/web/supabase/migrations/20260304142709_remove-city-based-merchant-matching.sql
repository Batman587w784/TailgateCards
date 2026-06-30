/*
 * Migration: Remove city-based merchant matching
 *
 * Previously, cardholders and org admins could see discounts from merchants
 * in the same city as their organization, even without an explicit partnership.
 *
 * This removes the city-based fallback so that discounts are only visible
 * when a super admin has explicitly paired the merchant with the organization
 * via organization_merchant_partnerships.
 */

-- Cardholder helper: partnership-only
CREATE OR REPLACE FUNCTION public.cardholder_can_see_merchant(target_merchant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.organization_merchant_partnerships omp
      ON omp.organization_id = c.organization_id
     AND omp.merchant_id = target_merchant_id
    WHERE c.cardholder_id = public.get_user_personal_account_id()
      AND c.status = 'activated'
  );
$$;

COMMENT ON FUNCTION public.cardholder_can_see_merchant(uuid) IS
  'SECURITY DEFINER: checks if current cardholder has access to a merchant via explicit partnership only. Bypasses nested RLS.';

-- Org admin helper: partnership-only
CREATE OR REPLACE FUNCTION public.org_admin_can_see_merchant(target_merchant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_profiles op
    JOIN public.organization_merchant_partnerships omp
      ON omp.organization_id = op.account_id
     AND omp.merchant_id = target_merchant_id
    WHERE public.has_role_on_account(op.account_id, 'org_admin')
  );
$$;

COMMENT ON FUNCTION public.org_admin_can_see_merchant(uuid) IS
  'SECURITY DEFINER: checks if current org admin has access to a merchant via explicit partnership only. Bypasses nested RLS.';

-- Update policy comments to reflect the change
COMMENT ON POLICY discounts_cardholder_read ON public.discounts IS
  'Cardholders see active discounts via SECURITY DEFINER helper (explicit partnership only)';

COMMENT ON POLICY discounts_organization_read ON public.discounts IS
  'Org admins see discounts via SECURITY DEFINER helper (explicit partnership only)';
