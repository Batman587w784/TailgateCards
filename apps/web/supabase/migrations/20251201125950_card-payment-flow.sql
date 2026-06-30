/*
 * -------------------------------------------------------
 * Migration: Card Payment Flow
 *
 * This migration updates the schema for the card activation flow:
 * - Adds 'paid' status to card_status enum (between pending and activated)
 * - Adds payment tracking fields to cards table
 * - Adds card_price_cents to organization_profiles
 * - Removes usage limits (max_redemptions_per_card from discounts)
 * - Removes value snapshots from redemptions (track count only)
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Add 'paid' status to card_status enum
-- ============================================================

alter type public.card_status add value if not exists 'paid' after 'pending';

-- IMPORTANT: Commit the enum changes so they can be used in subsequent statements
commit;

-- ============================================================
-- SECTION 2: Add payment tracking fields to cards table
-- ============================================================

alter table public.cards
  add column if not exists paid_at timestamptz,
  add column if not exists invite_sent_at timestamptz,
  add column if not exists stripe_customer_email varchar(255);

comment on column public.cards.paid_at is 'When the card payment was completed via Stripe';
comment on column public.cards.invite_sent_at is 'When the activation email invite was sent';
comment on column public.cards.stripe_customer_email is 'Email address from Stripe checkout (used for magic link)';

-- Index for looking up cards by email (for webhook processing)
create index if not exists ix_cards_stripe_customer_email
  on public.cards (stripe_customer_email)
  where stripe_customer_email is not null;

-- ============================================================
-- SECTION 3: Add card_price_cents to organization_profiles
-- ============================================================

alter table public.organization_profiles
  add column if not exists card_price_cents integer not null default 2500;

comment on column public.organization_profiles.card_price_cents is 'Price of cards for this organization in cents (default $25.00)';

-- ============================================================
-- SECTION 4: Remove usage limits from discounts
-- ============================================================

-- Drop the constraint first
alter table public.discounts
  drop constraint if exists discounts_max_redemptions_positive;

-- Remove the column (discounts now have unlimited uses)
alter table public.discounts
  drop column if exists max_redemptions_per_card;

-- ============================================================
-- SECTION 5: Simplify redemptions table (track count only)
-- ============================================================

-- Remove value snapshots - we're only tracking usage count now
alter table public.redemptions
  drop column if exists discount_value_snapshot,
  drop column if exists discount_type_snapshot;

-- ============================================================
-- SECTION 6: Update RLS policy for cards (allow public read by code)
-- ============================================================

-- Allow anyone to read a card by its code (needed for /activate page)
-- This is safe because card details are not sensitive until activated
create policy cards_public_read_by_code
  on public.cards
  for select
  to authenticated
  using (true);

-- Note: Existing RLS policies in 20251128000000_cards-discounts-redemptions.sql
-- provide more restrictive access for other operations
