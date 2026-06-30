-- Unique constraint: one account can only be linked to one card ever
-- This ensures each email/cardholder can only activate one card in their lifetime

-- First, clean up any existing duplicates by setting cardholder_id to NULL on older cards
-- Keep only the most recent card linked to each cardholder
WITH duplicates AS (
  SELECT id, cardholder_id, created_at,
         ROW_NUMBER() OVER (PARTITION BY cardholder_id ORDER BY created_at DESC) as rn
  FROM public.cards
  WHERE cardholder_id IS NOT NULL
)
UPDATE public.cards
SET cardholder_id = NULL
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Drop the old non-unique index (superseded by unique index below)
DROP INDEX IF EXISTS ix_cards_cardholder_id;

-- Create unique index for one-card-per-cardholder enforcement
CREATE UNIQUE INDEX IF NOT EXISTS ix_cards_cardholder_unique
ON public.cards(cardholder_id)
WHERE cardholder_id IS NOT NULL;
