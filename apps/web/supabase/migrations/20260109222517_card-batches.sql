-- Create batches table for grouping cards
CREATE TABLE IF NOT EXISTS public.batches (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name varchar(100) NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users,
  CONSTRAINT batches_org_name_unique UNIQUE (organization_id, name)
);

-- Enable RLS
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

-- Permissions
REVOKE ALL ON public.batches FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.batches TO authenticated, service_role;

-- Indexes
CREATE INDEX IF NOT EXISTS ix_batches_organization_id ON public.batches (organization_id);
CREATE INDEX IF NOT EXISTS ix_batches_created_at ON public.batches (created_at DESC);

-- Triggers for timestamps and user tracking
CREATE TRIGGER batches_set_timestamps
BEFORE INSERT OR UPDATE ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

CREATE TRIGGER batches_set_user_tracking
BEFORE INSERT OR UPDATE ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_user_tracking();

-- RLS Policies
CREATE POLICY super_admins_access_batches ON public.batches
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY batches_organization_read ON public.batches
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(organization_id));

-- Add batch_id to cards table
ALTER TABLE public.cards ADD COLUMN batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_cards_batch_id ON public.cards (batch_id) WHERE batch_id IS NOT NULL;

-- DATA MIGRATION: Create "Legacy Cards" batch for each org with existing cards
-- and assign all existing cards to their org's legacy batch
DO $$
DECLARE
  org_record RECORD;
  new_batch_id uuid;
BEGIN
  -- Find all organizations that have cards without a batch
  FOR org_record IN
    SELECT DISTINCT organization_id
    FROM public.cards
    WHERE batch_id IS NULL
  LOOP
    -- Create "Legacy Cards" batch for this organization
    INSERT INTO public.batches (name, organization_id, created_at)
    VALUES ('Legacy Cards', org_record.organization_id, now())
    RETURNING id INTO new_batch_id;

    -- Assign all cards from this org to the legacy batch
    UPDATE public.cards
    SET batch_id = new_batch_id
    WHERE organization_id = org_record.organization_id
      AND batch_id IS NULL;
  END LOOP;
END $$;
