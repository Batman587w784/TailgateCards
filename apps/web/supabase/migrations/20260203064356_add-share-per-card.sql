/*
 * -------------------------------------------------------
 * Migration: Add Share Per Card Sale to Organizations
 *
 * Adds share_per_card_cents column to organization_profiles
 * to allow different organizations to have custom revenue
 * shares per activated card.
 *
 * Default: 1250 cents ($12.50) - the typical organization share
 *
 * Updates revenue calculation functions to use this field.
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Add share_per_card_cents column
-- ============================================================

ALTER TABLE public.organization_profiles
  ADD COLUMN IF NOT EXISTS share_per_card_cents integer NOT NULL DEFAULT 1250;

COMMENT ON COLUMN public.organization_profiles.share_per_card_cents IS
  'The organization share per card sale in cents (e.g., 1250 = $12.50 per activated card)';

-- ============================================================
-- SECTION 2: Update get_organization_total_revenue function
-- Calculate as: COUNT(activated cards) * share_per_card_cents
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_organization_total_revenue(org_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT COUNT(c.id) FROM public.cards c
      WHERE c.organization_id = org_account_id
        AND c.status = 'activated'
    ) * (
      SELECT op.share_per_card_cents FROM public.organization_profiles op
      WHERE op.account_id = org_account_id
    ),
    0
  )::bigint;
$$;

-- ============================================================
-- SECTION 3: Update get_org_admin_revenue_stats function
-- Use share_per_card_cents for revenue calculations
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_admin_revenue_stats(org_account_id uuid)
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
      COUNT(*) FILTER (WHERE status = 'activated') AS activated_count,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
      COUNT(*) FILTER (WHERE payment_type = 'stripe' AND status = 'activated') AS stripe_count,
      COUNT(*) FILTER (WHERE payment_type = 'cash' AND status = 'activated') AS cash_count
    FROM public.cards
    WHERE organization_id = org_account_id
  )
  SELECT json_build_object(
    'total_revenue_cents', (cc.activated_count * os.share_per_card_cents)::bigint,
    'total_activated_revenue_cents', (cc.activated_count * os.share_per_card_cents)::bigint,
    'total_pending_revenue_cents', (cc.pending_count * os.share_per_card_cents)::bigint,
    'stripe_revenue_cents', (cc.stripe_count * os.share_per_card_cents)::bigint,
    'cash_revenue_cents', (cc.cash_count * os.share_per_card_cents)::bigint
  )
  FROM card_counts cc
  CROSS JOIN org_share os;
$$;

-- ============================================================
-- SECTION 4: Update get_org_admin_sales_over_time function
-- Use share_per_card_cents for monthly revenue
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_admin_sales_over_time(
  org_account_id uuid,
  months_back int DEFAULT 6
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
    (COALESCE(COUNT(c.id), 0) * os.share_per_card_cents)::bigint AS revenue_cents
  FROM months m
  CROSS JOIN org_share os
  LEFT JOIN public.cards c ON
    c.organization_id = org_account_id
    AND c.status = 'activated'
    AND date_trunc('month', c.activated_at) = m.month_start
  GROUP BY m.month_start, os.share_per_card_cents
  ORDER BY m.month_start;
$$;

-- ============================================================
-- SECTION 5: Update get_org_admin_top_distributors function
-- Use share_per_card_cents for distributor revenue
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_admin_top_distributors(
  org_account_id uuid,
  limit_count int DEFAULT 5
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
    (COALESCE(COUNT(*) FILTER (WHERE c.status = 'activated'), 0) * os.share_per_card_cents)::bigint AS revenue_cents
  FROM public.accounts_memberships am
  CROSS JOIN org_share os
  INNER JOIN public.accounts a ON a.primary_owner_user_id = am.user_id AND a.is_personal_account = true
  INNER JOIN public.cards c ON c.distributor_id = a.id
  WHERE am.account_id = org_account_id
    AND am.account_role = 'distributor'
    AND c.organization_id = org_account_id
  GROUP BY a.id, a.name, os.share_per_card_cents
  ORDER BY revenue_cents DESC
  LIMIT limit_count;
$$;

-- ============================================================
-- SECTION 6: Update get_org_admin_cards_distribution function
-- Use share_per_card_cents for total raised
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_admin_cards_distribution(org_account_id uuid)
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
