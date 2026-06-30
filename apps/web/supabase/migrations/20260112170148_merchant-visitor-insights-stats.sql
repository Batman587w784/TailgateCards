/*
 * -------------------------------------------------------
 * Migration: Merchant Visitor Insights Stats
 *
 * RPC functions for merchant visitor insights dashboard:
 * - KPI statistics (total redemptions, unique visitors, new visitors)
 * - Redemptions over time for charts
 * - Visit analytics (visitor segmentation by frequency)
 * - Recent scans list
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Get Merchant Visitor KPI Stats
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_merchant_visitor_kpi_stats(
  merchant_account_id uuid,
  time_period_months int DEFAULT 6
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH period_redemptions AS (
    SELECT r.card_id, r.redeemed_at
    FROM public.redemptions r
    WHERE r.merchant_id = merchant_account_id
      AND r.redeemed_at >= NOW() - (time_period_months || ' months')::interval
  ),
  -- Cards that had their FIRST EVER redemption at this merchant within the period
  first_redemptions AS (
    SELECT r.card_id, MIN(r.redeemed_at) as first_redemption_at
    FROM public.redemptions r
    WHERE r.merchant_id = merchant_account_id
    GROUP BY r.card_id
  ),
  new_visitors AS (
    SELECT DISTINCT pr.card_id
    FROM period_redemptions pr
    INNER JOIN first_redemptions fr ON fr.card_id = pr.card_id
    WHERE fr.first_redemption_at >= NOW() - (time_period_months || ' months')::interval
  )
  SELECT json_build_object(
    'total_redemptions', (SELECT COUNT(*) FROM period_redemptions)::int,
    'unique_visitors', (SELECT COUNT(DISTINCT card_id) FROM period_redemptions)::int,
    'new_visitors', (SELECT COUNT(*) FROM new_visitors)::int
  );
$$;

COMMENT ON FUNCTION public.get_merchant_visitor_kpi_stats(uuid, int) IS
  'Get visitor KPI statistics for a merchant dashboard';

GRANT EXECUTE ON FUNCTION public.get_merchant_visitor_kpi_stats(uuid, int) TO authenticated, service_role;

-- ============================================================
-- SECTION 2: Get Merchant Redemptions Over Time
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_merchant_redemptions_over_time(
  merchant_account_id uuid,
  months_back int DEFAULT 6
)
RETURNS TABLE (
  month text,
  redemption_count bigint
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
    to_char(m.month_start, 'Mon') AS month,
    COUNT(r.id) AS redemption_count
  FROM months m
  LEFT JOIN public.redemptions r ON
    r.merchant_id = merchant_account_id
    AND date_trunc('month', r.redeemed_at) = m.month_start
  GROUP BY m.month_start
  ORDER BY m.month_start;
$$;

COMMENT ON FUNCTION public.get_merchant_redemptions_over_time(uuid, int) IS
  'Get monthly redemptions data for a merchant dashboard chart';

GRANT EXECUTE ON FUNCTION public.get_merchant_redemptions_over_time(uuid, int) TO authenticated, service_role;

-- ============================================================
-- SECTION 3: Get Merchant Visit Analytics (Visitor Segments)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_merchant_visit_analytics(
  merchant_account_id uuid,
  time_period_months int DEFAULT 6
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH visitor_counts AS (
    SELECT card_id, COUNT(*) AS visit_count
    FROM public.redemptions
    WHERE merchant_id = merchant_account_id
      AND redeemed_at >= NOW() - (time_period_months || ' months')::interval
    GROUP BY card_id
  ),
  segments AS (
    SELECT
      COUNT(*) FILTER (WHERE visit_count = 1) AS one_visit,
      COUNT(*) FILTER (WHERE visit_count = 2) AS two_visits,
      COUNT(*) FILTER (WHERE visit_count = 3) AS three_visits,
      COUNT(*) FILTER (WHERE visit_count >= 4) AS four_plus_visits,
      COUNT(*) AS total_unique_visitors
    FROM visitor_counts
  )
  SELECT json_build_object(
    'total_unique_visitors', COALESCE(total_unique_visitors, 0)::int,
    'one_visit', COALESCE(one_visit, 0)::int,
    'two_visits', COALESCE(two_visits, 0)::int,
    'three_visits', COALESCE(three_visits, 0)::int,
    'four_plus_visits', COALESCE(four_plus_visits, 0)::int
  )
  FROM segments;
$$;

COMMENT ON FUNCTION public.get_merchant_visit_analytics(uuid, int) IS
  'Get visitor segmentation stats for a merchant dashboard donut chart';

GRANT EXECUTE ON FUNCTION public.get_merchant_visit_analytics(uuid, int) TO authenticated, service_role;

-- ============================================================
-- SECTION 4: Get Merchant Recent Scans
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_merchant_recent_scans(
  merchant_account_id uuid,
  limit_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  discount_id uuid,
  discount_title varchar,
  card_code text,
  redeemed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    r.id,
    r.discount_id,
    d.title AS discount_title,
    COALESCE(
      COALESCE(b.prefix, a.card_prefix) || '-' || c.card_number::text,
      'CARD-' || c.card_number::text
    ) AS card_code,
    r.redeemed_at
  FROM public.redemptions r
  INNER JOIN public.discounts d ON d.id = r.discount_id
  INNER JOIN public.cards c ON c.id = r.card_id
  LEFT JOIN public.batches b ON c.batch_id = b.id
  LEFT JOIN public.accounts a ON a.id = c.organization_id
  WHERE r.merchant_id = merchant_account_id
  ORDER BY r.redeemed_at DESC
  LIMIT limit_count;
$$;

COMMENT ON FUNCTION public.get_merchant_recent_scans(uuid, int) IS
  'Get recent redemption scans for a merchant dashboard';

GRANT EXECUTE ON FUNCTION public.get_merchant_recent_scans(uuid, int) TO authenticated, service_role;
