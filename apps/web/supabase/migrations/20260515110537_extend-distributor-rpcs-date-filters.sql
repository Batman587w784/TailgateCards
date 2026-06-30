-- Extend distributor dashboard RPCs to accept optional date range filters
-- so the page-wide date filter on the distributor dashboard can reach
-- every widget (KPIs, sales trend, recent activities), matching the
-- org-admin dashboard pattern.
--
-- Filter columns:
--   - card_stats / revenue_stats: cards.created_at (matches get_org_admin_*)
--   - sales_over_time:           cards.activated_at (chart shows activations)
--   - recent_activities:         cards.activated_at (already ordered by it)
--
-- Backward compatibility: new params default to NULL so existing callers
-- continue to work unchanged.

-- ============================================================
-- 1. get_distributor_card_stats
-- ============================================================

DROP FUNCTION IF EXISTS public.get_distributor_card_stats(uuid);

CREATE FUNCTION public.get_distributor_card_stats(
  p_distributor_id uuid,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_assigned bigint,
  remaining bigint,
  activated bigint,
  total_sales bigint,
  activation_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_distributor_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_assigned,
    COUNT(*) FILTER (WHERE c.status = 'pending')::bigint AS remaining,
    COUNT(*) FILTER (WHERE c.status = 'activated')::bigint AS activated,
    COUNT(*) FILTER (WHERE c.status = 'activated')::bigint AS total_sales,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE c.status = 'activated')::numeric / COUNT(*)) * 100, 1)
      ELSE 0
    END AS activation_rate
  FROM public.cards c
  WHERE c.distributor_id = p_distributor_id
    AND (p_date_from IS NULL OR c.created_at >= p_date_from)
    AND (p_date_to   IS NULL OR c.created_at <= p_date_to);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_card_stats(uuid, timestamptz, timestamptz) TO authenticated;

-- ============================================================
-- 2. get_distributor_revenue_stats
-- ============================================================

DROP FUNCTION IF EXISTS public.get_distributor_revenue_stats(uuid);

CREATE FUNCTION public.get_distributor_revenue_stats(
  p_distributor_id uuid,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_earnings_cents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_distributor_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(COALESCE(op.share_per_card_cents, 0)), 0)::bigint AS total_earnings_cents
  FROM public.cards c
  LEFT JOIN public.organization_profiles op ON op.account_id = c.organization_id
  WHERE c.distributor_id = p_distributor_id
    AND c.status = 'activated'
    AND (p_date_from IS NULL OR c.created_at >= p_date_from)
    AND (p_date_to   IS NULL OR c.created_at <= p_date_to);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_revenue_stats(uuid, timestamptz, timestamptz) TO authenticated;

-- ============================================================
-- 3. get_distributor_sales_over_time
-- When a date range is supplied it overrides p_months_back: the chart
-- spans the requested range, bucketed by month.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_distributor_sales_over_time(uuid, int);

CREATE FUNCTION public.get_distributor_sales_over_time(
  p_distributor_id uuid,
  p_months_back int DEFAULT 6,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  month text,
  month_start date,
  sales_count bigint,
  revenue_cents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start date;
  v_end date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_distributor_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_start := DATE_TRUNC(
    'month',
    COALESCE(p_date_from, NOW() - (INTERVAL '1 month' * (p_months_back - 1)))
  )::date;
  v_end := DATE_TRUNC('month', COALESCE(p_date_to, NOW()))::date;

  IF v_end < v_start THEN
    v_end := v_start;
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(v_start, v_end, INTERVAL '1 month')::date AS month_start
  )
  SELECT
    TO_CHAR(m.month_start, 'Mon') AS month,
    m.month_start,
    COALESCE(COUNT(c.id), 0)::bigint AS sales_count,
    COALESCE(SUM(COALESCE(op.share_per_card_cents, 0)), 0)::bigint AS revenue_cents
  FROM months m
  LEFT JOIN public.cards c
    ON c.distributor_id = p_distributor_id
    AND c.status = 'activated'
    AND DATE_TRUNC('month', c.activated_at) = m.month_start
    AND (p_date_from IS NULL OR c.activated_at >= p_date_from)
    AND (p_date_to   IS NULL OR c.activated_at <= p_date_to)
  LEFT JOIN public.organization_profiles op
    ON op.account_id = c.organization_id
  GROUP BY m.month_start
  ORDER BY m.month_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_sales_over_time(uuid, int, timestamptz, timestamptz) TO authenticated;

-- ============================================================
-- 4. get_distributor_recent_activities
-- ============================================================

DROP FUNCTION IF EXISTS public.get_distributor_recent_activities(uuid, int);

CREATE FUNCTION public.get_distributor_recent_activities(
  p_distributor_id uuid,
  p_limit int DEFAULT 20,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  activity_type text,
  message text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_distributor_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    'card_activated'::text AS activity_type,
    CASE
      WHEN c.card_type = 'digital' THEN
        'Card D-' || lpad(c.digital_card_number::text, 6, '0') || ' activated'
      ELSE
        'Card #' || c.card_number || ' activated'
    END ||
      CASE
        WHEN c.payment_type = 'cash'   THEN ' (Cash)'
        WHEN c.payment_type = 'stripe' THEN ' (Stripe)'
        ELSE ''
      END AS message,
    c.activated_at AS created_at
  FROM public.cards c
  WHERE c.distributor_id = p_distributor_id
    AND c.status = 'activated'
    AND c.activated_at IS NOT NULL
    AND (p_date_from IS NULL OR c.activated_at >= p_date_from)
    AND (p_date_to   IS NULL OR c.activated_at <= p_date_to)
  ORDER BY c.activated_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_recent_activities(uuid, int, timestamptz, timestamptz) TO authenticated;
