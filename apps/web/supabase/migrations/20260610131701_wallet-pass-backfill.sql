-- Migration: Wallet pass backfill
--
-- Seeds wallet_passes for already-activated cards whose holder optimistically
-- saved to Google Wallet (cardholder_profiles.google_wallet_added_at). This
-- makes org-wide discount/expiry changes reach EXISTING Google passes on the
-- first worker drain. Apple passes cannot be backfilled (existing ones lack the
-- embedded webServiceURL) and are intentionally excluded.
select public.backfill_wallet_passes();
