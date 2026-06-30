-- Extend discount_type enum with additional types
-- Note: PostgreSQL requires separate statements for each ADD VALUE

ALTER TYPE public.discount_type ADD VALUE IF NOT EXISTS 'free_item';
ALTER TYPE public.discount_type ADD VALUE IF NOT EXISTS 'bogo';
ALTER TYPE public.discount_type ADD VALUE IF NOT EXISTS 'other';

-- Helper function to count completed redemptions for a discount
CREATE OR REPLACE FUNCTION public.get_discount_redemption_count(discount_uuid uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::bigint, 0)
  FROM public.redemptions
  WHERE discount_id = discount_uuid AND status = 'completed';
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_discount_redemption_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discount_redemption_count(uuid) TO service_role;
