-- ============================================================
-- Migration: Fix Discount Unique Constraint
--
-- Changes:
-- 1. Drop unconditional unique constraint on merchant_id
-- 2. Create partial unique index that only applies to active discounts
--
-- This allows merchants to have multiple discounts as long as
-- only one is active at a time.
-- ============================================================

-- ============================================================
-- SECTION 1: Drop existing unconditional unique constraint
-- ============================================================

ALTER TABLE public.discounts
DROP CONSTRAINT IF EXISTS discounts_unique_merchant_id;

-- ============================================================
-- SECTION 2: Create partial unique index for active discounts only
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS discounts_unique_active_merchant_id
ON public.discounts (merchant_id)
WHERE is_active = true;
