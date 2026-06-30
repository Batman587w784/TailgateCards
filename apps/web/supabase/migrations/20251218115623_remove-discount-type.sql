-- ============================================================
-- Remove discount_type from discounts table
-- All discounts will now be percentage-only
-- ============================================================

-- Step 1: Update the activity logging trigger to not reference discount_type
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
      jsonb_build_object('discount_value', new.discount_value)
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
      jsonb_build_object('discount_value', new.discount_value)
    );
  END IF;

  RETURN new;
END;
$$;

-- Step 2: Drop the constraint that references discount_type
ALTER TABLE public.discounts
DROP CONSTRAINT IF EXISTS discounts_percentage_range;

-- Step 3: Drop the discount_type column
ALTER TABLE public.discounts
DROP COLUMN IF EXISTS discount_type;

-- Step 4: Add a check constraint for percentage range (0-100)
ALTER TABLE public.discounts
ADD CONSTRAINT discounts_percentage_range
CHECK (discount_value >= 0 AND discount_value <= 100);

-- Note: The discount_type enum is NOT dropped because:
-- - redemptions.discount_type_snapshot still references it for historical data
-- - Dropping enum types in PostgreSQL is complex (requires recreating dependent columns)
