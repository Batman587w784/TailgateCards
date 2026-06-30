-- Migration: tighten anon SELECT on public.cards to activation columns only.
--
-- 20251217014557_fix-cards-anon-access.sql granted anon table-wide SELECT on
-- public.cards so the /activate flow could resolve a card by code without a
-- session. M6 (20260508100446_m6-digital-cards.sql) then added claim_token,
-- digital_card_number, buyer_email, purchased_at to the same table — making
-- every live claim_token enumerable by any anonymous client via the REST API,
-- bypassing the get_digital_card_for_activation SECURITY DEFINER RPC that
-- was meant to be the only token-gated path.
--
-- Replace the table-wide GRANT with a column-restricted one matching exactly
-- what the /activate loader needs:
--   apps/web/app/activate/_lib/server/card-activation.loader.ts:121-131
--     .from('cards').select('id, card_number, status, price_cents, organization_id')
--
-- Authenticated users keep their existing table-wide SELECT (RLS continues to
-- gate row access); only the anon role is narrowed here.

revoke select on public.cards from anon;

grant select (
  id,
  card_number,
  status,
  price_cents,
  organization_id
) on public.cards to anon;
