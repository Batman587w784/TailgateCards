-- Physical card_number was previously unique per organization
-- (cards_org_physical_number_uniq). Card creation assigns sequence numbers
-- per batch and lookups in activate/validate use (batch_id, card_number),
-- so the org-wide constraint caused collisions when a second batch reused
-- low card numbers. Switch the uniqueness scope to the batch.

drop index if exists public.cards_org_physical_number_uniq;

create unique index cards_batch_physical_number_uniq
  on public.cards (batch_id, card_number)
  where card_type = 'physical' and card_number is not null;
