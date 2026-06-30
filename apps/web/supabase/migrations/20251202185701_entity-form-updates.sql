-- Add primary contact fields to organization_profiles (merchant_profiles already has them)
ALTER TABLE public.organization_profiles
ADD COLUMN IF NOT EXISTS primary_contact_name varchar(255);

ALTER TABLE public.organization_profiles
ADD COLUMN IF NOT EXISTS primary_contact_email varchar(320);

COMMENT ON COLUMN public.organization_profiles.primary_contact_name IS 'Primary contact person name';
COMMENT ON COLUMN public.organization_profiles.primary_contact_email IS 'Primary contact person email';

-- Add organization_id to accounts for distributor-organization relationship
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.accounts.organization_id IS 'The organization this distributor belongs to (for distributor accounts only)';

-- Create index for organization_id lookups
CREATE INDEX IF NOT EXISTS ix_accounts_organization_id
  ON public.accounts (organization_id)
  WHERE organization_id IS NOT NULL;

-- Update function to get distributor's organization name using new column
CREATE OR REPLACE FUNCTION public.get_distributor_organization_name(distributor_account_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    -- Primary: use direct organization_id reference
    (SELECT op.organization_name
     FROM public.accounts a
     INNER JOIN public.organization_profiles op ON op.account_id = a.organization_id
     WHERE a.id = distributor_account_id),
    -- Fallback: use accounts_memberships (backwards compatibility)
    (SELECT op.organization_name
     FROM public.accounts_memberships am
     INNER JOIN public.organization_profiles op ON op.account_id = am.account_id
     WHERE am.user_id = (
       SELECT primary_owner_user_id FROM public.accounts WHERE id = distributor_account_id
     )
     LIMIT 1)
  );
$$;
