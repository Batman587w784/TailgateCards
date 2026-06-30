/*
 * -------------------------------------------------------
 * Migration: Fix org-admin dashboard RPCs to use share_per_card_cents
 *
 * The share-per-card migration (20260203064356) added 1-arg overloads of
 * these functions that used share_per_card_cents, but the dashboard loader
 * calls the 4-arg filter-aware overloads from 20260122143350 which still
 * sum price_cents. Because the signatures differ, CREATE OR REPLACE did not
 * replace the filter-aware versions — it added orphan overloads instead.
 *
 * This migration:
 *   1. Drops the orphan 1-arg overloads (no callers).
 *   2. Rewrites the 4-arg filter-aware overloads to use share_per_card_cents
 *      while preserving all filter parameters.
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Drop orphan 1-arg overloads
-- ============================================================

DROP FUNCTION IF EXISTS public.get_org_admin_revenue_stats(uuid);
DROP FUNCTION IF EXISTS public.get_org_admin_sales_over_time(uuid, int);
DROP FUNCTION IF EXISTS public.get_org_admin_top_distributors(uuid, int);
DROP FUNCTION IF EXISTS public.get_org_admin_cards_distribution(uuid);

-- ============================================================
-- SECTION 2: get_org_admin_revenue_stats (filter-aware)
-- Revenue = COUNT(activated matching filters) * share_per_card_cents
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_admin_revenue_stats(
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
  WITH org_share AS (
    SELECT share_per_card_cents
    FROM public.organization_profiles
    WHERE account_id = org_account_id
  ),
  card_counts AS (
    SELECT
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE status = 'activated') AS activated_count,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
      COUNT(*) FILTER (WHERE payment_type = 'stripe' AND status = 'activated') AS stripe_count,
      COUNT(*) FILTER (WHERE payment_type = 'cash' AND status = 'activated') AS cash_count
    FROM public.cards
    WHERE organization_id = org_account_id
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to IS NULL OR created_at <= p_date_to)
      AND (p_distributor_id IS NULL OR distributor_id = p_distributor_id)
  )
  SELECT json_build_object(
    'total_revenue_cents', (cc.total_count * os.share_per_card_cents)::bigint,
    'total_activated_revenue_cents', (cc.activated_count * os.share_per_card_cents)::bigint,
    'total_pending_revenue_cents', (cc.pending_count * os.share_per_card_cents)::bigint,
    'stripe_revenue_cents', (cc.stripe_count * os.share_per_card_cents)::bigint,
    'cash_revenue_cents', (cc.cash_count * os.share_per_card_cents)::bigint
  )
  FROM card_counts cc
  CROSS JOIN org_share os;
$$;

COMMENT ON FUNCTION public.get_org_admin_revenue_stats(uuid, timestamptz, timestamptz, uuid) IS
  'Get revenue statistics for an organization admin dashboard with optional filters. Revenue is count * organization_profiles.share_per_card_cents.';

GRANT EXECUTE ON FUNCTION public.get_org_admin_revenue_stats(uuid, timestamptz, timestamptz, uuid) TO authenticated, service_role;

-- ============================================================
-- SECTION 3: get_org_admin_sales_over_time (filter-aware)
-- Monthly revenue = COUNT(activated in month matching filter) * share_per_card_cents
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_admin_sales_over_time(
  org_account_id uuid,
  months_back int DEFAULT 6,
  p_distributor_id uuid DEFAULT NULL
)
RETURNS TABLE (
  month text,
  sales_count bigint,
  revenue_cents bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH org_share AS (
    SELECT share_per_card_cents
    FROM public.organization_profiles
    WHERE account_id = org_account_id
  ),
  months AS (
    SELECT generate_series(
      date_trunc('month', NOW()) - ((months_back - 1) * INTERVAL '1 month'),
      date_trunc('month', NOW()),
      '1 month'::interval
    ) AS month_start
  )
  SELECT
    to_char(m.month_start, 'Mon YYYY') AS month,
    COUNT(c.id) AS sales_count,
    (COUNT(c.id) * os.share_per_card_cents)::bigint AS revenue_cents
  FROM months m
  CROSS JOIN org_share os
  LEFT JOIN public.cards c ON
    c.organization_id = org_account_id
    AND c.status = 'activated'
    AND date_trunc('month', c.activated_at) = m.month_start
    AND (p_distributor_id IS NULL OR c.distributor_id = p_distributor_id)
  GROUP BY m.month_start, os.share_per_card_cents
  ORDER BY m.month_start;
$$;

COMMENT ON FUNCTION public.get_org_admin_sales_over_time(uuid, int, uuid) IS
  'Get monthly sales data for an organization admin dashboard chart with optional distributor filter. Revenue is count * organization_profiles.share_per_card_cents.';

GRANT EXECUTE ON FUNCTION public.get_org_admin_sales_over_time(uuid, int, uuid) TO authenticated, service_role;

-- ============================================================
-- SECTION 4: get_org_admin_top_distributors (filter-aware)
-- Per-distributor revenue = COUNT(activated matching date filter) * share_per_card_cents
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_admin_top_distributors(
  org_account_id uuid,
  limit_count int DEFAULT 5,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  distributor_id uuid,
  distributor_name text,
  cards_activated bigint,
  total_cards bigint,
  revenue_cents bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH org_share AS (
    SELECT share_per_card_cents
    FROM public.organization_profiles
    WHERE account_id = org_account_id
  )
  SELECT
    a.id AS distributor_id,
    a.name AS distributor_name,
    COUNT(*) FILTER (WHERE c.status = 'activated') AS cards_activated,
    COUNT(*) AS total_cards,
    (COUNT(*) FILTER (WHERE c.status = 'activated') * os.share_per_card_cents)::bigint AS revenue_cents
  FROM public.accounts_memberships am
  CROSS JOIN org_share os
  INNER JOIN public.accounts a ON a.primary_owner_user_id = am.user_id AND a.is_personal_account = true
  INNER JOIN public.cards c ON c.distributor_id = a.id
  WHERE am.account_id = org_account_id
    AND am.account_role = 'distributor'
    AND c.organization_id = org_account_id
    AND (p_date_from IS NULL OR c.created_at >= p_date_from)
    AND (p_date_to IS NULL OR c.created_at <= p_date_to)
  GROUP BY a.id, a.name, os.share_per_card_cents
  ORDER BY revenue_cents DESC
  LIMIT limit_count;
$$;

COMMENT ON FUNCTION public.get_org_admin_top_distributors(uuid, int, timestamptz, timestamptz) IS
  'Get top performing distributors for an organization admin dashboard with optional date filter. Revenue is count * organization_profiles.share_per_card_cents.';

GRANT EXECUTE ON FUNCTION public.get_org_admin_top_distributors(uuid, int, timestamptz, timestamptz) TO authenticated, service_role;

-- ============================================================
-- SECTION 5: get_org_admin_cards_distribution (filter-aware)
-- Total raised = COUNT(activated matching filters) * share_per_card_cents
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_admin_cards_distribution(
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
  WITH org_share AS (
    SELECT share_per_card_cents
    FROM public.organization_profiles
    WHERE account_id = org_account_id
  ),
  card_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE distributor_id IS NOT NULL) AS assigned_cards,
      COUNT(*) FILTER (WHERE distributor_id IS NULL) AS unassigned_cards,
      COUNT(*) FILTER (WHERE status = 'activated') AS activated_cards,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_cards
    FROM public.cards
    WHERE organization_id = org_account_id
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to IS NULL OR created_at <= p_date_to)
      AND (p_distributor_id IS NULL OR distributor_id = p_distributor_id)
  )
  SELECT json_build_object(
    'assigned_cards', cs.assigned_cards::int,
    'unassigned_cards', cs.unassigned_cards::int,
    'activated_cards', cs.activated_cards::int,
    'pending_cards', cs.pending_cards::int,
    'total_raised_cents', (cs.activated_cards * os.share_per_card_cents)::bigint
  )
  FROM card_stats cs
  CROSS JOIN org_share os;
$$;

COMMENT ON FUNCTION public.get_org_admin_cards_distribution(uuid, timestamptz, timestamptz, uuid) IS
  'Get card distribution stats for an organization admin dashboard donut chart with optional filters. Total raised is activated_count * organization_profiles.share_per_card_cents.';

GRANT EXECUTE ON FUNCTION public.get_org_admin_cards_distribution(uuid, timestamptz, timestamptz, uuid) TO authenticated, service_role;
