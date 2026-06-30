-- Distributor Dashboard Stats RPC Functions
-- Note: p_distributor_id is the user_id from auth.users (cards.distributor_id = user_id)

-- Get distributor's card statistics
CREATE OR REPLACE FUNCTION public.get_distributor_card_stats(p_distributor_id uuid)
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
    COUNT(*)::bigint as total_assigned,
    COUNT(*) FILTER (WHERE c.status = 'pending')::bigint as remaining,
    COUNT(*) FILTER (WHERE c.status = 'activated')::bigint as activated,
    COUNT(*) FILTER (WHERE c.status = 'activated')::bigint as total_sales,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE c.status = 'activated')::numeric / COUNT(*)) * 100, 1)
      ELSE 0
    END as activation_rate
  FROM public.cards c
  WHERE c.distributor_id = p_distributor_id;
END;
$$;

-- Get distributor's total earnings
CREATE OR REPLACE FUNCTION public.get_distributor_revenue_stats(p_distributor_id uuid)
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
    COALESCE(SUM(c.price_cents), 0)::bigint as total_earnings_cents
  FROM public.cards c
  WHERE c.distributor_id = p_distributor_id
  AND c.status = 'activated';
END;
$$;

-- Get distributor's sales over time (monthly)
CREATE OR REPLACE FUNCTION public.get_distributor_sales_over_time(
  p_distributor_id uuid,
  p_months_back int DEFAULT 6
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_distributor_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      DATE_TRUNC('month', NOW() - INTERVAL '1 month' * (p_months_back - 1)),
      DATE_TRUNC('month', NOW()),
      INTERVAL '1 month'
    )::date as month_start
  )
  SELECT
    TO_CHAR(m.month_start, 'Mon') as month,
    m.month_start,
    COALESCE(COUNT(c.id), 0)::bigint as sales_count,
    COALESCE(SUM(c.price_cents), 0)::bigint as revenue_cents
  FROM months m
  LEFT JOIN public.cards c ON
    c.distributor_id = p_distributor_id
    AND c.status = 'activated'
    AND DATE_TRUNC('month', c.activated_at) = m.month_start
  GROUP BY m.month_start
  ORDER BY m.month_start;
END;
$$;

-- Get distributor's recent activities
CREATE OR REPLACE FUNCTION public.get_distributor_recent_activities(
  p_distributor_id uuid,
  p_limit int DEFAULT 20
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
    'card_activated'::text as activity_type,
    'Card #' || c.card_number || ' activated' ||
      CASE WHEN c.payment_type = 'cash' THEN ' (Cash)'
           WHEN c.payment_type = 'stripe' THEN ' (Stripe)'
           ELSE ''
      END as message,
    c.activated_at as created_at
  FROM public.cards c
  WHERE c.distributor_id = p_distributor_id
  AND c.status = 'activated'
  AND c.activated_at IS NOT NULL
  ORDER BY c.activated_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_distributor_card_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distributor_revenue_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distributor_sales_over_time(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distributor_recent_activities(uuid, int) TO authenticated;
