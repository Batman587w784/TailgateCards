/*
 * -------------------------------------------------------
 * Migration: Organization Admin Dashboard Filters
 *
 * Updates RPC functions to accept optional filter parameters:
 * - p_date_from: Filter by created_at >= date
 * - p_date_to: Filter by created_at <= date
 * - p_distributor_id: Filter by distributor
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Get Org Admin Card Stats (with filters)
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
    'inactive_cards', COUNT(*) FILTER (WHERE status = 'pending')::int,
    'unassigned_cards', COUNT(*) FILTER (WHERE distributor_id IS NULL AND status = 'pending')::int,
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
  'Get card statistics for an organization admin dashboard with optional filters';

GRANT EXECUTE ON FUNCTION public.get_org_admin_card_stats(uuid, timestamptz, timestamptz, uuid) TO authenticated, service_role;

-- ============================================================
-- SECTION 2: Get Org Admin Revenue Stats (with filters)
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
  SELECT json_build_object(
    'total_revenue_cents', COALESCE(SUM(price_cents), 0)::bigint,
    'total_activated_revenue_cents', COALESCE(SUM(price_cents) FILTER (WHERE status = 'activated'), 0)::bigint,
    'total_pending_revenue_cents', COALESCE(SUM(price_cents) FILTER (WHERE status = 'pending'), 0)::bigint,
    'stripe_revenue_cents', COALESCE(SUM(price_cents) FILTER (WHERE payment_type = 'stripe' AND status = 'activated'), 0)::bigint,
    'cash_revenue_cents', COALESCE(SUM(price_cents) FILTER (WHERE payment_type = 'cash' AND status = 'activated'), 0)::bigint
  )
  FROM public.cards
  WHERE organization_id = org_account_id
    AND (p_date_from IS NULL OR created_at >= p_date_from)
    AND (p_date_to IS NULL OR created_at <= p_date_to)
    AND (p_distributor_id IS NULL OR distributor_id = p_distributor_id);
$$;

COMMENT ON FUNCTION public.get_org_admin_revenue_stats(uuid, timestamptz, timestamptz, uuid) IS
  'Get revenue statistics for an organization admin dashboard with optional filters';

GRANT EXECUTE ON FUNCTION public.get_org_admin_revenue_stats(uuid, timestamptz, timestamptz, uuid) TO authenticated, service_role;

-- ============================================================
-- SECTION 3: Get Org Admin Distributor Stats (with filters)
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
    'active_distributors', COUNT(DISTINCT am.user_id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM public.cards c
        WHERE c.distributor_id = a.id
        AND c.activated_at >= NOW() - INTERVAL '30 days'
        AND (p_date_from IS NULL OR c.created_at >= p_date_from)
        AND (p_date_to IS NULL OR c.created_at <= p_date_to)
      )
    )::int
  )
  FROM public.accounts_memberships am
  INNER JOIN public.accounts a ON a.primary_owner_user_id = am.user_id AND a.is_personal_account = true
  WHERE am.account_id = org_account_id
    AND am.account_role = 'distributor';
$$;

COMMENT ON FUNCTION public.get_org_admin_distributor_stats(uuid, timestamptz, timestamptz) IS
  'Get distributor statistics for an organization admin dashboard with optional filters';

GRANT EXECUTE ON FUNCTION public.get_org_admin_distributor_stats(uuid, timestamptz, timestamptz) TO authenticated, service_role;

-- ============================================================
-- SECTION 4: Get Org Admin Sales Over Time (with distributor filter)
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
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', NOW()) - ((months_back - 1) * INTERVAL '1 month'),
      date_trunc('month', NOW()),
      '1 month'::interval
    ) AS month_start
  )
  SELECT
    to_char(m.month_start, 'Mon YYYY') AS month,
    COUNT(c.id) AS sales_count,
    COALESCE(SUM(c.price_cents), 0)::bigint AS revenue_cents
  FROM months m
  LEFT JOIN public.cards c ON
    c.organization_id = org_account_id
    AND c.status = 'activated'
    AND date_trunc('month', c.activated_at) = m.month_start
    AND (p_distributor_id IS NULL OR c.distributor_id = p_distributor_id)
  GROUP BY m.month_start
  ORDER BY m.month_start;
$$;

COMMENT ON FUNCTION public.get_org_admin_sales_over_time(uuid, int, uuid) IS
  'Get monthly sales data for an organization admin dashboard chart with optional distributor filter';

GRANT EXECUTE ON FUNCTION public.get_org_admin_sales_over_time(uuid, int, uuid) TO authenticated, service_role;

-- ============================================================
-- SECTION 5: Get Org Admin Top Distributors (with date filter)
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
  SELECT
    a.id AS distributor_id,
    a.name AS distributor_name,
    COUNT(*) FILTER (WHERE c.status = 'activated') AS cards_activated,
    COUNT(*) AS total_cards,
    COALESCE(SUM(c.price_cents) FILTER (WHERE c.status = 'activated'), 0)::bigint AS revenue_cents
  FROM public.accounts_memberships am
  INNER JOIN public.accounts a ON a.primary_owner_user_id = am.user_id AND a.is_personal_account = true
  INNER JOIN public.cards c ON c.distributor_id = a.id
  WHERE am.account_id = org_account_id
    AND am.account_role = 'distributor'
    AND c.organization_id = org_account_id
    AND (p_date_from IS NULL OR c.created_at >= p_date_from)
    AND (p_date_to IS NULL OR c.created_at <= p_date_to)
  GROUP BY a.id, a.name
  ORDER BY revenue_cents DESC
  LIMIT limit_count;
$$;

COMMENT ON FUNCTION public.get_org_admin_top_distributors(uuid, int, timestamptz, timestamptz) IS
  'Get top performing distributors for an organization admin dashboard with optional date filter';

GRANT EXECUTE ON FUNCTION public.get_org_admin_top_distributors(uuid, int, timestamptz, timestamptz) TO authenticated, service_role;

-- ============================================================
-- SECTION 6: Get Org Admin Recent Activations (with filters)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_admin_recent_activations(
  org_account_id uuid,
  limit_count int DEFAULT 10,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_distributor_id uuid DEFAULT NULL
)
RETURNS TABLE (
  activation_id uuid,
  display_code text,
  cardholder_name text,
  distributor_name text,
  activated_at timestamptz,
  price_cents int
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    c.id AS activation_id,
    COALESCE(b.prefix, org.card_prefix, '') || '-' || c.card_number::text AS display_code,
    cardholder.name AS cardholder_name,
    distributor.name AS distributor_name,
    c.activated_at,
    c.price_cents
  FROM public.cards c
  LEFT JOIN public.batches b ON c.batch_id = b.id
  LEFT JOIN public.accounts org ON c.organization_id = org.id
  LEFT JOIN public.accounts cardholder ON c.cardholder_id = cardholder.id
  LEFT JOIN public.accounts distributor ON c.distributor_id = distributor.id
  WHERE c.organization_id = org_account_id
    AND c.status = 'activated'
    AND c.activated_at IS NOT NULL
    AND (p_date_from IS NULL OR c.created_at >= p_date_from)
    AND (p_date_to IS NULL OR c.created_at <= p_date_to)
    AND (p_distributor_id IS NULL OR c.distributor_id = p_distributor_id)
  ORDER BY c.activated_at DESC
  LIMIT limit_count;
$$;

COMMENT ON FUNCTION public.get_org_admin_recent_activations(uuid, int, timestamptz, timestamptz, uuid) IS
  'Get recent card activations for an organization admin dashboard with optional filters';

GRANT EXECUTE ON FUNCTION public.get_org_admin_recent_activations(uuid, int, timestamptz, timestamptz, uuid) TO authenticated, service_role;

-- ============================================================
-- SECTION 7: Get Org Admin Cards Distribution Stats (with filters)
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
  SELECT json_build_object(
    'assigned_cards', COUNT(*) FILTER (WHERE distributor_id IS NOT NULL)::int,
    'unassigned_cards', COUNT(*) FILTER (WHERE distributor_id IS NULL)::int,
    'activated_cards', COUNT(*) FILTER (WHERE status = 'activated')::int,
    'pending_cards', COUNT(*) FILTER (WHERE status = 'pending')::int,
    'total_raised_cents', COALESCE(SUM(price_cents) FILTER (WHERE status = 'activated'), 0)::bigint
  )
  FROM public.cards
  WHERE organization_id = org_account_id
    AND (p_date_from IS NULL OR created_at >= p_date_from)
    AND (p_date_to IS NULL OR created_at <= p_date_to)
    AND (p_distributor_id IS NULL OR distributor_id = p_distributor_id);
$$;

COMMENT ON FUNCTION public.get_org_admin_cards_distribution(uuid, timestamptz, timestamptz, uuid) IS
  'Get card distribution stats for an organization admin dashboard donut chart with optional filters';

GRANT EXECUTE ON FUNCTION public.get_org_admin_cards_distribution(uuid, timestamptz, timestamptz, uuid) TO authenticated, service_role;
