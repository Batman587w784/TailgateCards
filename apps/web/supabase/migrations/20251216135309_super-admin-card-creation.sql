-- Migration: Super Admin Card Creation
-- Add card_prefix to accounts and change cards.card_code to cards.card_number

-- 1. Add card_prefix column to accounts table (for organizations)
ALTER TABLE public.accounts ADD COLUMN card_prefix varchar(10);

-- Add unique constraint on card_prefix (only one org can have a given prefix)
CREATE UNIQUE INDEX accounts_card_prefix_unique ON public.accounts (card_prefix) WHERE card_prefix IS NOT NULL;

-- 2. Modify cards table: replace card_code with card_number
-- First, drop the old card_code column
ALTER TABLE public.cards DROP COLUMN IF EXISTS card_code;

-- Add card_number column (incremental per organization)
ALTER TABLE public.cards ADD COLUMN card_number integer NOT NULL DEFAULT 0;

-- Assign unique card_numbers to existing cards per organization
-- This must happen BEFORE adding the unique constraint
WITH numbered_cards AS (
  SELECT id, organization_id,
         ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at, id) as rn
  FROM public.cards
)
UPDATE public.cards
SET card_number = nc.rn
FROM numbered_cards nc
WHERE public.cards.id = nc.id;

-- Add unique constraint on (organization_id, card_number)
ALTER TABLE public.cards ADD CONSTRAINT cards_org_number_unique
  UNIQUE (organization_id, card_number);

-- Remove the default after adding the constraint
ALTER TABLE public.cards ALTER COLUMN card_number DROP DEFAULT;

-- 3. Drop old generate_card_code function if it exists
DROP FUNCTION IF EXISTS generate_card_code();

-- 4. Update cardholders view to use card_number instead of card_code
-- First check what views reference card_code and update them
DROP VIEW IF EXISTS cardholders_view;

CREATE OR REPLACE VIEW cardholders_view AS
SELECT
  c.id AS card_id,
  c.card_number,
  a.card_prefix AS organization_prefix,
  CONCAT(a.card_prefix, '-', c.card_number) AS display_code,
  c.cardholder_id,
  c.organization_id,
  c.activated_at,
  c.expires_at,
  c.status AS card_status,
  ch.name AS cardholder_name,
  ch.email AS cardholder_email
FROM cards c
JOIN accounts a ON a.id = c.organization_id
LEFT JOIN accounts ch ON ch.id = c.cardholder_id
WHERE c.cardholder_id IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON cardholders_view TO authenticated;
GRANT SELECT ON cardholders_view TO service_role;
