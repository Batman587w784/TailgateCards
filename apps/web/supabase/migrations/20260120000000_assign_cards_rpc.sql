-- Migration: Add atomic card assignment function
-- This function atomically assigns a count of unassigned cards to a distributor
-- Using FOR UPDATE SKIP LOCKED to prevent race conditions

CREATE OR REPLACE FUNCTION public.assign_cards_to_distributor_by_count(
  p_organization_id uuid,
  p_distributor_id uuid,
  p_count integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assigned_count integer;
BEGIN
  -- Verify the user has org_admin role on this organization
  IF NOT public.has_role_on_account(p_organization_id, 'org_admin') THEN
    RAISE EXCEPTION 'Unauthorized: User does not have org_admin role on this organization';
  END IF;

  -- Atomically select and update cards in one transaction
  WITH selected_cards AS (
    SELECT id
    FROM public.cards
    WHERE organization_id = p_organization_id
      AND distributor_id IS NULL
    ORDER BY created_at
    LIMIT p_count
    FOR UPDATE SKIP LOCKED
  ),
  updated_cards AS (
    UPDATE public.cards
    SET
      distributor_id = p_distributor_id,
      assigned_at = now()
    WHERE id IN (SELECT id FROM selected_cards)
    RETURNING id
  )
  SELECT count(*)::integer INTO v_assigned_count
  FROM updated_cards;

  RETURN v_assigned_count;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.assign_cards_to_distributor_by_count(uuid, uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.assign_cards_to_distributor_by_count IS
  'Atomically assigns a count of unassigned cards to a distributor. Uses FOR UPDATE SKIP LOCKED to prevent race conditions.';
