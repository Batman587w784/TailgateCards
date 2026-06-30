-- Migration: M6 audit #5 — declare merchant validate-read on public.cards.
--
-- Today, cross-org merchant validation (e.g. /validate?card_id=<uuid>) only
-- works because cards_public_read_for_activation grants SELECT to authenticated
-- USING (true). The merchant policy is *implicit*: a future tightening of the
-- activation policy would silently break /validate; a future relaxing of the
-- column-restricted GRANT (20260510134148) would silently re-leak data. Make
-- the right explicit, then narrow the activation policy so digital cards are
-- only reachable via the SECURITY DEFINER claim-token RPC.

-- 1. Explicit merchant validate-read.
--
-- "Has any merchant membership" is enough — the validate flow is universal:
-- merchants accept any org's card, and the redemption ties the card to the
-- merchant's own discount (their authority is over the discount, not the card).
-- No status filter so the loader can still surface specific feedback (expired,
-- cancelled, pending) instead of a generic "Card not found".
create policy cards_merchant_validate_read
  on public.cards
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.accounts_memberships am
      where am.user_id = (select auth.uid())
        and am.account_role = 'merchant'
    )
  );

-- 2. Narrow the activation policy to physical cards only.
--
-- The /activate?code=<code> loader resolves a (batch, card_number) pair and
-- selects (id, card_number, status, price_cents, organization_id) — physical
-- only by construction. Digital cards reach activation via
-- get_digital_card_for_activation (SECURITY DEFINER, claim-token gated), so
-- they don't need direct row access for unprivileged callers. Anonymous and
-- authenticated-without-other-role users keep the activation path; merchants
-- and other roles see digital cards through their declared policies.
drop policy if exists cards_public_read_for_activation on public.cards;

create policy cards_public_read_for_activation
  on public.cards
  for select
  to anon, authenticated
  using (card_type = 'physical');
