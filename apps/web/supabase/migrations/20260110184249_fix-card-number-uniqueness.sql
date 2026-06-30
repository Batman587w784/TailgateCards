-- Fix card number uniqueness constraint
-- Old: unique per organization (organization_id, card_number)
-- New: unique per batch (batch_id, card_number)

-- Drop the old organization-level constraint
ALTER TABLE public.cards
DROP CONSTRAINT IF EXISTS cards_org_number_unique;

-- Add new batch-level constraint
-- Card numbers are now unique within each batch
ALTER TABLE public.cards
ADD CONSTRAINT cards_batch_number_unique UNIQUE (batch_id, card_number);
