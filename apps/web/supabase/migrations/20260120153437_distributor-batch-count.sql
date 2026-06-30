/*
 * -------------------------------------------------------
 * Migration: Distributor Batch Count Function
 *
 * Adds a function to count distinct batches assigned to a distributor.
 * This counts unique batch_ids from cards assigned to the distributor.
 * -------------------------------------------------------
 */

-- Distributor batch count (count of distinct batches with cards assigned)
CREATE OR REPLACE FUNCTION public.get_distributor_batch_count(distributor_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COUNT(DISTINCT batch_id)::bigint
  FROM public.cards
  WHERE distributor_id = distributor_account_id
    AND batch_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_batch_count(uuid) TO authenticated, service_role;
