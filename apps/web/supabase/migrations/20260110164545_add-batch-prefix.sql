-- Add prefix column to batches table
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS prefix varchar(10);

-- DATA MIGRATION: Populate existing batches with unique prefixes
-- For legacy batches, use the org's card_prefix + batch number
DO $$
DECLARE
  org_record RECORD;
  batch_record RECORD;
  batch_counter INTEGER;
  org_prefix TEXT;
  new_prefix TEXT;
BEGIN
  -- Process each organization that has batches
  FOR org_record IN
    SELECT DISTINCT b.organization_id, a.card_prefix
    FROM public.batches b
    LEFT JOIN public.accounts a ON a.id = b.organization_id
    WHERE b.prefix IS NULL
  LOOP
    batch_counter := 0;
    org_prefix := COALESCE(org_record.card_prefix, 'BATCH');

    -- Process each batch for this org, ordered by creation date
    FOR batch_record IN
      SELECT id, name
      FROM public.batches
      WHERE organization_id = org_record.organization_id
        AND prefix IS NULL
      ORDER BY created_at ASC
    LOOP
      batch_counter := batch_counter + 1;

      -- Generate prefix: use org prefix + number (e.g., ACME1, ACME2)
      -- First batch gets just the org prefix if it's "Legacy Cards"
      IF batch_counter = 1 AND batch_record.name = 'Legacy Cards' THEN
        new_prefix := org_prefix;
      ELSE
        new_prefix := org_prefix || batch_counter::TEXT;
      END IF;

      -- Truncate if too long (max 10 chars)
      new_prefix := SUBSTRING(new_prefix FROM 1 FOR 10);

      UPDATE public.batches
      SET prefix = new_prefix
      WHERE id = batch_record.id;
    END LOOP;
  END LOOP;
END $$;

-- Make prefix NOT NULL after populating existing data
ALTER TABLE public.batches ALTER COLUMN prefix SET NOT NULL;

-- Add unique constraint for org + prefix combination
ALTER TABLE public.batches
ADD CONSTRAINT batches_org_prefix_unique UNIQUE (organization_id, prefix);

-- Add index for prefix lookups
CREATE INDEX IF NOT EXISTS ix_batches_prefix ON public.batches (prefix);

-- Allow anon to read batches for card activation flow
-- (similar to existing anon access on cards and accounts tables)
CREATE POLICY batches_public_read_for_activation
  ON public.batches
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Grant select permission to anon role on batches table
GRANT SELECT ON public.batches TO anon;
