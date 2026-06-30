-- Fix distributor dashboard RPCs:
--   1. Revenue + monthly sales sum each card's organization's share_per_card_cents
--      (was: SUM(c.price_cents) — overstated and didn't reflect distributor cut).
--      Distributor cards span orgs, so the share is joined per-card.
--   2. Recent activities branch the message on card_type so digital activations
--      no longer produce NULL messages (c.card_number is NULL for digital cards).
--
-- Signatures are unchanged so distributor-dashboard.loader.ts keeps compiling.
-- DROP FUNCTION IF EXISTS … (sig) avoids overload collisions.

-- ============================================================
-- 1. get_distributor_revenue_stats
-- ============================================================

DROP FUNCTION IF EXISTS public.get_distributor_revenue_stats(uuid);

CREATE FUNCTION public.get_distributor_revenue_stats(p_distributor_id uuid)
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
    AND c.status = 'activated';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_revenue_stats(uuid) TO authenticated;

-- ============================================================
-- 2. get_distributor_sales_over_time
-- ============================================================

DROP FUNCTION IF EXISTS public.get_distributor_sales_over_time(uuid, int);

CREATE FUNCTION public.get_distributor_sales_over_time(
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
    )::date AS month_start
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
  LEFT JOIN public.organization_profiles op
    ON op.account_id = c.organization_id
  GROUP BY m.month_start
  ORDER BY m.month_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_sales_over_time(uuid, int) TO authenticated;

-- ============================================================
-- 3. get_distributor_recent_activities
-- ============================================================

DROP FUNCTION IF EXISTS public.get_distributor_recent_activities(uuid, int);

CREATE FUNCTION public.get_distributor_recent_activities(
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
  ORDER BY c.activated_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_recent_activities(uuid, int) TO authenticated;
