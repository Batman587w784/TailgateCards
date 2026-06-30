-- Add assigned_at column to track when card was assigned to distributor
-- This migration is idempotent and safe to run on production

-- Add column only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'cards'
    AND column_name = 'assigned_at'
  ) THEN
    ALTER TABLE public.cards ADD COLUMN assigned_at timestamptz;
  END IF;
END $$;

-- Backfill existing cards: use created_at as default for cards that have a distributor
-- Only updates rows where assigned_at is NULL to avoid overwriting any existing data
UPDATE public.cards
SET assigned_at = created_at
WHERE distributor_id IS NOT NULL AND assigned_at IS NULL;

-- Add index for filtering by assigned_at (if not exists)
CREATE INDEX IF NOT EXISTS idx_cards_assigned_at ON public.cards(assigned_at);
