/*
 * -------------------------------------------------------
 * Migration: Batch-Level Distributor Assignment
 *
 * Changes batch assignment from card-level to batch-level:
 * - Add distributor_id to batches table
 * - Create trigger to sync cards when batch is assigned
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Add distributor_id to batches table
-- ============================================================

ALTER TABLE public.batches
ADD COLUMN IF NOT EXISTS distributor_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.batches.distributor_id IS 'Distributor who owns this entire batch (assigned by org admin)';

-- Index for distributor lookups
CREATE INDEX IF NOT EXISTS ix_batches_distributor_id
  ON public.batches (distributor_id)
  WHERE distributor_id IS NOT NULL;

-- ============================================================
-- SECTION 2: Trigger to sync cards when batch is assigned
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_batch_cards_distributor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- When batch's distributor_id changes, update all pending cards in that batch
  IF OLD.distributor_id IS DISTINCT FROM NEW.distributor_id THEN
    UPDATE public.cards
    SET
      distributor_id = NEW.distributor_id,
      updated_at = now()
    WHERE batch_id = NEW.id
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_batch_cards_distributor() IS
  'Syncs distributor_id from batch to all pending cards in that batch';

DROP TRIGGER IF EXISTS batches_sync_distributor ON public.batches;

CREATE TRIGGER batches_sync_distributor
AFTER UPDATE OF distributor_id ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.sync_batch_cards_distributor();

-- ============================================================
-- SECTION 3: RLS Policy for org admins to update batch distributor
-- ============================================================

-- Org admins can update distributor_id on batches for their organization
CREATE POLICY org_admin_update_batch_distributor ON public.batches
  FOR UPDATE TO authenticated
  USING (
    public.has_platform_role('org_admin'::public.platform_role)
    AND EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = batches.organization_id
        AND am.user_id = (SELECT auth.uid())
        AND am.account_role = 'org_admin'
    )
  )
  WITH CHECK (
    public.has_platform_role('org_admin'::public.platform_role)
    AND EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = batches.organization_id
        AND am.user_id = (SELECT auth.uid())
        AND am.account_role = 'org_admin'
    )
  );

-- ============================================================
-- SECTION 4: Data Migration - Sync existing card assignments
-- ============================================================

-- For batches where all cards have the same distributor, set batch distributor_id
UPDATE public.batches b
SET distributor_id = (
  SELECT c.distributor_id
  FROM public.cards c
  WHERE c.batch_id = b.id
    AND c.distributor_id IS NOT NULL
  LIMIT 1
)
WHERE b.distributor_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.cards c
    WHERE c.batch_id = b.id AND c.distributor_id IS NOT NULL
  )
  AND (
    SELECT COUNT(DISTINCT c.distributor_id)
    FROM public.cards c
    WHERE c.batch_id = b.id AND c.distributor_id IS NOT NULL
  ) = 1;
