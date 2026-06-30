/*
 * -------------------------------------------------------
 * Migration: Drop orphan 1-arg overloads of org-admin RPCs
 *
 * Three org-admin dashboard RPCs still carry the pre-filter overloads from
 * 20260111083618. The filter-aware versions added in 20260122143350 used
 * CREATE OR REPLACE FUNCTION with a different signature, which appends a
 * new overload instead of replacing — leaving v1 and v2 coexisting. The
 * share-per-card fix (20260421143016) cleaned up four of the seven RPCs
 * but missed these three, so PostgREST returns PGRST203 (overload
 * ambiguity) for every dashboard call and the org-admin dashboard renders
 * empty.
 *
 * No callers reference the 1-arg overloads — the loader always passes the
 * filter signature.
 * -------------------------------------------------------
 */

DROP FUNCTION IF EXISTS public.get_org_admin_card_stats(uuid);
DROP FUNCTION IF EXISTS public.get_org_admin_distributor_stats(uuid);
DROP FUNCTION IF EXISTS public.get_org_admin_recent_activations(uuid, int);
