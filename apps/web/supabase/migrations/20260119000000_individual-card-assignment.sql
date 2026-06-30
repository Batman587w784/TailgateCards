/*
 * -------------------------------------------------------
 * Migration: Individual Card Assignment
 *
 * Removes batch-level distributor assignment in favor of
 * individual card assignment:
 * - Remove distributor_id from batches table
 * - Remove sync trigger and function
 * - Remove batch-level RLS policy
 *
 * Cards already have distributor_id and org_admin update
 * policy exists, so individual assignment is ready to use.
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Remove batch-level distributor sync trigger
-- ============================================================

-- Drop the trigger first (depends on the function)
DROP TRIGGER IF EXISTS batches_sync_distributor ON public.batches;

-- Drop the sync function
DROP FUNCTION IF EXISTS public.sync_batch_cards_distributor();

-- ============================================================
-- SECTION 2: Remove batch-level RLS policy
-- ============================================================

DROP POLICY IF EXISTS org_admin_update_batch_distributor ON public.batches;

-- ============================================================
-- SECTION 3: Remove distributor_id column from batches
-- ============================================================

-- Drop the index first
DROP INDEX IF EXISTS ix_batches_distributor_id;

-- Drop the column
ALTER TABLE public.batches
DROP COLUMN IF EXISTS distributor_id;
