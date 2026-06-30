-- Add consent fields to cardholder_profiles
ALTER TABLE public.cardholder_profiles
ADD COLUMN IF NOT EXISTS terms_accepted boolean default false not null,
ADD COLUMN IF NOT EXISTS marketing_opt_in boolean default false not null;

COMMENT ON COLUMN public.cardholder_profiles.terms_accepted IS 'Whether cardholder accepted terms of service';
COMMENT ON COLUMN public.cardholder_profiles.marketing_opt_in IS 'Whether cardholder opted in to marketing communications';
