/*
 * -------------------------------------------------------
 * Migration: Visitor Insights Date Range Filter Support
 *
 * Updates RPC functions to accept optional date range
 * parameters (p_date_from, p_date_to) while maintaining
 * backward compatibility with time_period_months.
 * -------------------------------------------------------
 */

-- ============================================================
-- Drop old function signatures to prevent overloading
-- ============================================================
DROP FUNCTION IF EXISTS public.get_merchant_visitor_kpi_stats(uuid, int);
DROP FUNCTION IF EXISTS public.get_merchant_redemptions_over_time(uuid, int);
DROP FUNCTION IF EXISTS public.get_merchant_visit_analytics(uuid, int);
DROP FUNCTION IF EXISTS public.get_merchant_recent_scans(uuid, int);

-- ============================================================
-- SECTION 1: Update Get Merchant Visitor KPI Stats
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_merchant_visitor_kpi_stats(
  merchant_account_id uuid,
  time_period_months int DEFAULT 6,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
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
      AND (
        CASE WHEN p_date_from IS NOT NULL OR p_date_to IS NOT NULL THEN
          r.redeemed_at >= COALESCE(p_date_from, '1970-01-01'::timestamptz)
          AND r.redeemed_at <= COALESCE(p_date_to, NOW())
        ELSE
          r.redeemed_at >= NOW() - (time_period_months || ' months')::interval
        END
      )
  ),
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
    WHERE (
      CASE WHEN p_date_from IS NOT NULL OR p_date_to IS NOT NULL THEN
        fr.first_redemption_at >= COALESCE(p_date_from, '1970-01-01'::timestamptz)
        AND fr.first_redemption_at <= COALESCE(p_date_to, NOW())
      ELSE
        fr.first_redemption_at >= NOW() - (time_period_months || ' months')::interval
      END
    )
  )
  SELECT json_build_object(
    'total_redemptions', (SELECT COUNT(*) FROM period_redemptions)::int,
    'unique_visitors', (SELECT COUNT(DISTINCT card_id) FROM period_redemptions)::int,
    'new_visitors', (SELECT COUNT(*) FROM new_visitors)::int
  );
$$;

COMMENT ON FUNCTION public.get_merchant_visitor_kpi_stats(uuid, int, timestamptz, timestamptz) IS
  'Get visitor KPI statistics for a merchant dashboard with optional date range filter';

GRANT EXECUTE ON FUNCTION public.get_merchant_visitor_kpi_stats(uuid, int, timestamptz, timestamptz) TO authenticated, service_role;

-- ============================================================
-- SECTION 2: Update Get Merchant Redemptions Over Time
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_merchant_redemptions_over_time(
  merchant_account_id uuid,
  months_back int DEFAULT 6,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
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
  WITH date_bounds AS (
    SELECT
      CASE WHEN p_date_from IS NOT NULL THEN date_trunc('month', p_date_from)
           ELSE date_trunc('month', NOW()) - ((months_back - 1) * INTERVAL '1 month')
      END AS start_month,
      CASE WHEN p_date_to IS NOT NULL THEN date_trunc('month', p_date_to)
           ELSE date_trunc('month', NOW())
      END AS end_month
  ),
  months AS (
    SELECT generate_series(
      (SELECT start_month FROM date_bounds),
      (SELECT end_month FROM date_bounds),
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
    AND (p_date_from IS NULL OR r.redeemed_at >= p_date_from)
    AND (p_date_to IS NULL OR r.redeemed_at <= p_date_to)
  GROUP BY m.month_start
  ORDER BY m.month_start;
$$;

COMMENT ON FUNCTION public.get_merchant_redemptions_over_time(uuid, int, timestamptz, timestamptz) IS
  'Get monthly redemptions data for a merchant dashboard chart with optional date range filter';

GRANT EXECUTE ON FUNCTION public.get_merchant_redemptions_over_time(uuid, int, timestamptz, timestamptz) TO authenticated, service_role;

-- ============================================================
-- SECTION 3: Update Get Merchant Visit Analytics
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_merchant_visit_analytics(
  merchant_account_id uuid,
  time_period_months int DEFAULT 6,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
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
      AND (
        CASE WHEN p_date_from IS NOT NULL OR p_date_to IS NOT NULL THEN
          redeemed_at >= COALESCE(p_date_from, '1970-01-01'::timestamptz)
          AND redeemed_at <= COALESCE(p_date_to, NOW())
        ELSE
          redeemed_at >= NOW() - (time_period_months || ' months')::interval
        END
      )
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

COMMENT ON FUNCTION public.get_merchant_visit_analytics(uuid, int, timestamptz, timestamptz) IS
  'Get visitor segmentation stats for a merchant dashboard donut chart with optional date range filter';

GRANT EXECUTE ON FUNCTION public.get_merchant_visit_analytics(uuid, int, timestamptz, timestamptz) TO authenticated, service_role;

-- ============================================================
-- SECTION 4: Update Get Merchant Recent Scans
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_merchant_recent_scans(
  merchant_account_id uuid,
  limit_count int DEFAULT 10,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
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
    AND (p_date_from IS NULL OR r.redeemed_at >= p_date_from)
    AND (p_date_to IS NULL OR r.redeemed_at <= p_date_to)
  ORDER BY r.redeemed_at DESC
  LIMIT limit_count;
$$;

COMMENT ON FUNCTION public.get_merchant_recent_scans(uuid, int, timestamptz, timestamptz) IS
  'Get recent redemption scans for a merchant dashboard with optional date range filter';

GRANT EXECUTE ON FUNCTION public.get_merchant_recent_scans(uuid, int, timestamptz, timestamptz) TO authenticated, service_role;
