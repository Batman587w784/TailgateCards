-- ============================================================
-- FIX RLS POLICIES FOR CARDHOLDER DASHBOARD
-- ============================================================
-- Issues:
-- 1. Cardholders cannot read merchant_profiles (needed to display discount merchant info)
-- 2. Cardholders cannot view expired discounts (needed for "Expired" tab)
-- ============================================================

-- ============================================================
-- 1. Allow public read access to merchant profiles (basic business info)
-- ============================================================
-- Merchant business name, address, etc. are public-facing information
-- needed when displaying discounts to cardholders.

create policy merchant_profiles_public_read
  on public.merchant_profiles
  for select
  to authenticated
  using (true);

-- ============================================================
-- 2. Allow cardholders to view all discounts (including expired)
-- ============================================================
-- Cardholders need to see:
-- - Active discounts (for browsing available offers)
-- - Expired discounts (for historical context in their dashboard)
-- - Inactive discounts they've previously redeemed
--
-- Drop the restrictive public_read policy and replace with a more permissive one.

drop policy if exists discounts_public_read on public.discounts;

-- Allow any authenticated user to view all discounts
-- (active, inactive, expired - needed for cardholder dashboard)
create policy discounts_public_read
  on public.discounts
  for select
  to authenticated
  using (true);
