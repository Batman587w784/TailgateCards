/*
 * -------------------------------------------------------
 * Migration: Organization Admin Distributors
 *
 * RPC functions for org admins to assign card batches
 * and RLS policies for distributor management.
 *
 * Note: Data queries are done in TypeScript for maintainability.
 * Only transactional/complex operations are kept as RPCs.
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Assign Cards to Distributor (needs DB-level locking)
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_cards_to_distributor(
  org_id uuid,
  dist_id uuid,
  quantity int
)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  assigned_count int;
BEGIN
  -- Verify distributor belongs to the organization
  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts a
    INNER JOIN public.accounts_memberships am ON am.user_id = a.primary_owner_user_id
    WHERE a.id = dist_id
      AND a.is_personal_account = true
      AND am.account_id = org_id
      AND am.account_role = 'distributor'
  ) THEN
    RAISE EXCEPTION 'Distributor does not belong to this organization';
  END IF;

  -- Assign unassigned cards to the distributor
  WITH cards_to_assign AS (
    SELECT id
    FROM public.cards
    WHERE organization_id = org_id
      AND distributor_id IS NULL
      AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT quantity
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.cards
  SET
    distributor_id = dist_id,
    updated_at = now()
  WHERE id IN (SELECT id FROM cards_to_assign);

  GET DIAGNOSTICS assigned_count = ROW_COUNT;
  RETURN assigned_count;
END;
$$;

COMMENT ON FUNCTION public.assign_cards_to_distributor(uuid, uuid, int) IS
  'Assign a quantity of unassigned cards from an organization to a distributor';

GRANT EXECUTE ON FUNCTION public.assign_cards_to_distributor(uuid, uuid, int) TO authenticated, service_role;

-- ============================================================
-- SECTION 2: Get Unassigned Cards Count for Organization
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_unassigned_cards_count(org_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COUNT(*)::bigint
  FROM public.cards
  WHERE organization_id = org_account_id
    AND distributor_id IS NULL
    AND status = 'pending';
$$;

COMMENT ON FUNCTION public.get_org_unassigned_cards_count(uuid) IS
  'Count unassigned pending cards for an organization';

GRANT EXECUTE ON FUNCTION public.get_org_unassigned_cards_count(uuid) TO authenticated, service_role;

-- ============================================================
-- SECTION 3: RLS Policies for Org Admin to Manage Distributors
-- ============================================================

-- Allow org admins to update accounts of distributors in their organization
CREATE POLICY org_admin_update_distributor_accounts
  ON public.accounts
  FOR UPDATE
  TO authenticated
  USING (
    -- User is org_admin and the target account is a distributor in their org
    public.has_platform_role('org_admin'::public.platform_role)
    AND is_personal_account = true
    AND EXISTS (
      SELECT 1
      FROM public.accounts_memberships am_dist
      INNER JOIN public.accounts_memberships am_admin ON am_admin.account_id = am_dist.account_id
      WHERE am_dist.user_id = accounts.primary_owner_user_id
        AND am_dist.account_role = 'distributor'
        AND am_admin.user_id = auth.uid()
        AND am_admin.account_role = 'org_admin'
    )
  )
  WITH CHECK (
    public.has_platform_role('org_admin'::public.platform_role)
    AND is_personal_account = true
    AND EXISTS (
      SELECT 1
      FROM public.accounts_memberships am_dist
      INNER JOIN public.accounts_memberships am_admin ON am_admin.account_id = am_dist.account_id
      WHERE am_dist.user_id = accounts.primary_owner_user_id
        AND am_dist.account_role = 'distributor'
        AND am_admin.user_id = auth.uid()
        AND am_admin.account_role = 'org_admin'
    )
  );

-- Allow org admins to delete distributor memberships from their organization
CREATE POLICY org_admin_delete_distributor_memberships
  ON public.accounts_memberships
  FOR DELETE
  TO authenticated
  USING (
    account_role = 'distributor'
    AND public.has_platform_role('org_admin'::public.platform_role)
    AND EXISTS (
      SELECT 1
      FROM public.accounts_memberships am_admin
      WHERE am_admin.account_id = accounts_memberships.account_id
        AND am_admin.user_id = auth.uid()
        AND am_admin.account_role = 'org_admin'
    )
  );
