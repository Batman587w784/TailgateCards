-- Add postal_code column to cardholder_profiles table
-- This column was referenced in card activation code but never created
-- Without this column, the upsert in confirmPaymentAndActivate fails silently,
-- causing user names to not be saved during card activation

alter table public.cardholder_profiles
add column if not exists postal_code varchar(50);

comment on column public.cardholder_profiles.postal_code is 'Postal/ZIP code collected during card activation';

-- Add index for geographic/analytics queries (consistent with country field pattern)
create index if not exists ix_cardholder_profiles_postal_code
on public.cardholder_profiles (postal_code)
where postal_code is not null;
