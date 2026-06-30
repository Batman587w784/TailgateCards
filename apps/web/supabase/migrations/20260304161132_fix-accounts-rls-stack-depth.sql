/*
 * Migration: Fix Accounts RLS Stack Depth
 *
 * The accounts_merchant_public_picture_read and accounts_cardholder_view_org
 * policies use inline EXISTS subqueries on merchant_profiles and cards. These
 * trigger nested RLS evaluation that, combined with accounts_read's own deep
 * function chain, exceeds PostgreSQL's 2048kB max_stack_depth limit.
 *
 * Fix: Replace inline subqueries with SECURITY DEFINER helper functions that
 * bypass RLS on the inner tables, breaking the recursive evaluation chain.
 *
 * Reconstructed from the test remote on 2026-05-10. The original was applied
 * directly to test (likely an incident hotfix) without a committed file. Prod
 * does not yet have it — promotion needs a separate push.
 */

-- ============================================================
-- SECTION 1: Security Definer Helper Functions
-- ============================================================

-- Check if an account has a merchant_profiles row (bypasses RLS)
-- Safe: merchant_profiles already has a USING (true) public read policy
CREATE OR REPLACE FUNCTION public.is_merchant_account(target_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_profiles WHERE account_id = target_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_merchant_account(uuid) TO authenticated;

-- Check if user has a card from an organization (bypasses RLS)
-- Safe: scoped to current user via get_user_personal_account_id()
CREATE OR REPLACE FUNCTION public.is_card_organization(target_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cards
    WHERE cardholder_id = public.get_user_personal_account_id()
      AND organization_id = target_org_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_card_organization(uuid) TO authenticated;

-- ============================================================
-- SECTION 2: Recreate Account Policies Using Helpers
-- ============================================================

DROP POLICY IF EXISTS accounts_merchant_public_picture_read ON public.accounts;

CREATE POLICY accounts_merchant_public_picture_read
ON public.accounts
FOR SELECT
TO authenticated
USING (public.is_merchant_account(id));

DROP POLICY IF EXISTS accounts_cardholder_view_org ON public.accounts;

CREATE POLICY accounts_cardholder_view_org
ON public.accounts
FOR SELECT
TO authenticated
USING (public.is_card_organization(id));
