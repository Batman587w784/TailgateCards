/*
 * -------------------------------------------------------
 * Migration: Fix Distributors View Organization ID
 *
 * The distributors_view was using accounts.organization_id
 * but the actual org relationship is through accounts_memberships.account_id.
 * -------------------------------------------------------
 */

CREATE OR REPLACE VIEW public.distributors_view AS
SELECT
  a.id,
  a.name,
  a.email,
  a.phone,
  a.is_active,
  a.created_at,
  am.account_id AS organization_id,  -- Use membership's account_id (the org)
  am.account_role
FROM public.accounts a
JOIN public.accounts_memberships am ON am.user_id = a.primary_owner_user_id
WHERE a.is_personal_account = true
  AND am.account_role = 'distributor';

COMMENT ON VIEW public.distributors_view IS 'View of all distributor accounts with their organization membership';
