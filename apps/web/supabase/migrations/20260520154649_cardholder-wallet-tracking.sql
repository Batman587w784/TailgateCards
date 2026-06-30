-- Track when a cardholder added their card to Apple Wallet / Google Wallet.
-- These are optimistic timestamps set when the cardholder clicks the corresponding
-- button on the dashboard banner — Apple and Google do not provide a platform
-- callback to confirm the save, so this captures intent, not confirmation.
-- Used to hide the "Add to Wallet" nag banner once at least one is set.

alter table public.cardholder_profiles
  add column if not exists apple_wallet_added_at timestamptz,
  add column if not exists google_wallet_added_at timestamptz;

comment on column public.cardholder_profiles.apple_wallet_added_at
  is 'When the cardholder added their card to Apple Wallet (optimistic; set on button click — no platform callback exists)';
comment on column public.cardholder_profiles.google_wallet_added_at
  is 'When the cardholder added their card to Google Wallet (optimistic; set on button click — no platform callback exists)';
