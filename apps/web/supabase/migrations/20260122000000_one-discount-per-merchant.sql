-- ============================================================
-- Migration: One Discount Per Merchant
--
-- Changes:
-- 1. Remove discount_value column from discounts (percentage now in name)
-- 2. Add unique constraint on merchant_id (one discount per merchant)
-- 3. Clean up existing data (keep most recent per merchant)
--
-- IMPORTANT: discount_value_snapshot in redemptions is PRESERVED
-- for historical data integrity.
-- ============================================================

-- ============================================================
-- SECTION 1: Data Cleanup - Keep only most recent discount per merchant
-- ============================================================

WITH ranked_discounts AS (
  SELECT
    id,
    merchant_id,
    ROW_NUMBER() OVER (
      PARTITION BY merchant_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) as rn
  FROM public.discounts
),
discounts_to_delete AS (
  SELECT id FROM ranked_discounts WHERE rn > 1
)
DELETE FROM public.discounts
WHERE id IN (SELECT id FROM discounts_to_delete);

-- ============================================================
-- SECTION 2: Update activity logging trigger (remove discount_value references)
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_log_discount_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_merchant_name text;
BEGIN
  -- Get merchant name
  SELECT a.name INTO v_merchant_name
  FROM public.accounts a
  WHERE a.id = new.merchant_id;

  -- Discount created
  IF tg_op = 'INSERT' THEN
    PERFORM public.log_activity(
      'discount_created'::public.activity_type,
      'Discount campaign created: "' || new.title || '" - ' || v_merchant_name,
      NULL,
      new.merchant_id,
      'discount',
      new.id,
      jsonb_build_object('title', new.title)
    );
  END IF;

  -- Discount updated
  IF tg_op = 'UPDATE' THEN
    PERFORM public.log_activity(
      'discount_updated'::public.activity_type,
      'Discount campaign updated: "' || new.title || '" - ' || v_merchant_name,
      NULL,
      new.merchant_id,
      'discount',
      new.id,
      jsonb_build_object('title', new.title)
    );
  END IF;

  RETURN new;
END;
$$;

-- ============================================================
-- SECTION 3: Drop existing constraints that reference discount_value
-- ============================================================

ALTER TABLE public.discounts
DROP CONSTRAINT IF EXISTS discounts_value_positive;

ALTER TABLE public.discounts
DROP CONSTRAINT IF EXISTS discounts_percentage_range;

-- ============================================================
-- SECTION 4: Remove discount_value column
-- ============================================================

ALTER TABLE public.discounts
DROP COLUMN IF EXISTS discount_value;

-- ============================================================
-- SECTION 5: Add unique constraint on merchant_id
-- ============================================================

ALTER TABLE public.discounts
ADD CONSTRAINT discounts_unique_merchant_id UNIQUE (merchant_id);
