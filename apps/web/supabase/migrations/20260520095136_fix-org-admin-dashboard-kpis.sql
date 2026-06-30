/*
 * -------------------------------------------------------
 * Migration: Fix org-admin dashboard KPI definitions
 *
 * Aligns the dashboard KPIs with the rest of the app:
 *
 *   1. get_org_admin_card_stats (4-arg filter-aware):
 *      - unassigned_cards: drop the status='pending' filter so the dashboard
 *        matches loadUnassignedCardCount (cards-page.loader.ts) and the
 *        donut chart's get_org_admin_cards_distribution. The KPI subtitle
 *        "Not assigned to distributors" means exactly what it says — any
 *        card without a distributor_id, regardless of status.
 *      - inactive_cards: include status='paid' alongside 'pending'. M6 routes
 *        digital cards through pending -> paid -> activated, and physical
 *        Stripe-paid cards through pending -> paid -> activated. The KPI
 *        subtitle is "Pending activation" — both statuses qualify.
 *
 *   2. get_org_admin_distributor_stats (3-arg filter-aware):
 *      - active_distributors: redefine as memberships whose underlying
 *        personal account has is_active = true. This matches
 *        distributors_view.is_active (used by the distributors list page
 *        and loadDistributorsForSelect). The previous "activated cards in
 *        last 30 days" semantic was opaque and incomparable with the
 *        "of N total" subtitle that shows total memberships.
 *      - drop the now-unused date_from/date_to params (kept the signature
 *        compatible by leaving them in place but ignored).
 *
 *   3. Drop orphan 1-arg overloads left behind by 20260421143016 (which
 *      only cleaned up the share-per-card RPCs):
 *        public.get_org_admin_card_stats(uuid)
 *        public.get_org_admin_distributor_stats(uuid)
 *        public.get_org_admin_recent_activations(uuid, int)
 *      supabase-js strips undefined keys, so the no-filter dashboard call
 *      currently routes to these orphans instead of the filter-aware
 *      overloads — a footgun that already bit the April share-per-card fix.
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Drop orphan 1-arg overloads
-- ============================================================

DROP FUNCTION IF EXISTS public.get_org_admin_card_stats(uuid);
DROP FUNCTION IF EXISTS public.get_org_admin_distributor_stats(uuid);
DROP FUNCTION IF EXISTS public.get_org_admin_recent_activations(uuid, int);

-- ============================================================
-- SECTION 2: get_org_admin_card_stats (filter-aware)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_admin_card_stats(
  org_account_id uuid,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_distributor_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'total_cards', COUNT(*)::int,
    'inactive_cards', COUNT(*) FILTER (WHERE status IN ('pending', 'paid'))::int,
    'unassigned_cards', COUNT(*) FILTER (WHERE distributor_id IS NULL)::int,
    'cards_activated', COUNT(*) FILTER (WHERE status = 'activated')::int,
    'expired_cards', COUNT(*) FILTER (WHERE status = 'expired')::int,
    'cancelled_cards', COUNT(*) FILTER (WHERE status = 'cancelled')::int
  )
  FROM public.cards
  WHERE organization_id = org_account_id
    AND (p_date_from IS NULL OR created_at >= p_date_from)
    AND (p_date_to IS NULL OR created_at <= p_date_to)
    AND (p_distributor_id IS NULL OR distributor_id = p_distributor_id);
$$;

COMMENT ON FUNCTION public.get_org_admin_card_stats(uuid, timestamptz, timestamptz, uuid) IS
  'Get card statistics for an organization admin dashboard with optional filters. inactive_cards covers pending+paid (both pre-activation states); unassigned_cards covers any status without a distributor_id.';

GRANT EXECUTE ON FUNCTION public.get_org_admin_card_stats(uuid, timestamptz, timestamptz, uuid) TO authenticated, service_role;

-- ============================================================
-- SECTION 3: get_org_admin_distributor_stats (filter-aware)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_admin_distributor_stats(
  org_account_id uuid,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'total_distributors', COUNT(DISTINCT am.user_id)::int,
    'active_distributors', COUNT(DISTINCT am.user_id) FILTER (WHERE a.is_active)::int
  )
  FROM public.accounts_memberships am
  INNER JOIN public.accounts a
    ON a.primary_owner_user_id = am.user_id
   AND a.is_personal_account = true
  WHERE am.account_id = org_account_id
    AND am.account_role = 'distributor';
$$;

COMMENT ON FUNCTION public.get_org_admin_distributor_stats(uuid, timestamptz, timestamptz) IS
  'Get distributor statistics for an organization admin dashboard. active_distributors matches distributors_view.is_active (the personal-account active flag), the same semantic the distributors list page uses. date params kept for forward compatibility but currently ignored.';

GRANT EXECUTE ON FUNCTION public.get_org_admin_distributor_stats(uuid, timestamptz, timestamptz) TO authenticated, service_role;
