BEGIN;
create extension "basejump-supabase_test_helpers" version '0.0.6';

select plan(6);

-- Regression test for M6 audit #5 —
-- 20260510173000_cards-merchant-validate-rls.sql.
--
-- Two changes locked in here:
--  1. cards_merchant_validate_read: any authenticated user with at least one
--     account_role='merchant' membership can SELECT any card, regardless of
--     which organization owns it (cross-org NFC validation is intentional).
--  2. cards_public_read_for_activation narrowed to card_type='physical': a
--     digital card is no longer reachable through the activation policy. The
--     SECURITY DEFINER claim-token RPC (get_digital_card_for_activation) is
--     the only path for unprivileged callers to learn about a digital card.

set local role service_role;

-- Org A: holds the cards being read in the assertions.
select tests.create_supabase_user('mvr-admin-a', 'mvr-admin-a@test.com');
select makerkit.authenticate_as('mvr-admin-a');
select public.create_team_account('MVR Org A');

-- Org B: the merchant user belongs here, NOT to Org A. Cross-org is the point.
select tests.create_supabase_user('mvr-admin-b', 'mvr-admin-b@test.com');
select makerkit.authenticate_as('mvr-admin-b');
select public.create_team_account('MVR Org B');

select tests.create_supabase_user('mvr-merchant', 'mvr-merchant@test.com');
select tests.create_supabase_user('mvr-rando',    'mvr-rando@test.com');

set local role service_role;

do $$
declare
  v_org_a uuid;
  v_org_b uuid;
  v_batch_id uuid;
  v_physical_id uuid;
  v_digital_id uuid;
begin
  select id into v_org_a from public.accounts where name = 'MVR Org A' limit 1;
  select id into v_org_b from public.accounts where name = 'MVR Org B' limit 1;

  insert into public.organization_profiles (account_id, organization_name, share_per_card_cents)
  values (v_org_a, 'MVR Org A', 1000),
         (v_org_b, 'MVR Org B', 1000);

  -- mvr-merchant has a merchant membership on Org B only.
  insert into public.accounts_memberships (account_id, user_id, account_role)
  values (v_org_b, tests.get_supabase_uid('mvr-merchant'), 'merchant');

  insert into public.batches (organization_id, prefix, name)
  values (v_org_a, 'MVRA', 'Batch 1')
  returning id into v_batch_id;

  -- Physical card in Org A.
  insert into public.cards (
    organization_id, batch_id, card_type, status, card_number, price_cents
  ) values (
    v_org_a, v_batch_id, 'physical', 'pending', 1, 2500
  ) returning id into v_physical_id;

  -- Digital card in Org A (paid, unclaimed — the riskiest row to leak).
  insert into public.cards (
    organization_id, card_type, status,
    claim_token, digital_card_number,
    buyer_email, purchased_at, paid_at,
    price_cents, payment_type, stripe_payment_intent_id, stripe_customer_email
  ) values (
    v_org_a, 'digital', 'paid',
    'mvrtest-token-abcdef0123456789', 1,
    'buyer@mvrtest.com', now(), now(),
    2500, 'stripe', 'pi_mvrtest', 'buyer@mvrtest.com'
  ) returning id into v_digital_id;

  perform set_config('mvr.physical_id', v_physical_id::text, true);
  perform set_config('mvr.digital_id',  v_digital_id::text,  true);
end $$;

-- ============================================================================
-- 1. Merchant of Org B can read a physical card from Org A (cross-org).
-- ============================================================================

select makerkit.authenticate_as('mvr-merchant');

select results_eq(
  format(
    $$ select id from public.cards where id = %L $$,
    current_setting('mvr.physical_id')
  ),
  format($$ values (%L::uuid) $$, current_setting('mvr.physical_id')),
  'merchant of another org can SELECT a physical card via cards_merchant_validate_read'
);

-- ============================================================================
-- 2. Merchant of Org B can read a digital card from Org A (cross-org). This
--    is the regression that breaks the moment the activation policy is
--    tightened without a declared merchant policy in place.
-- ============================================================================

select results_eq(
  format(
    $$ select id from public.cards where id = %L $$,
    current_setting('mvr.digital_id')
  ),
  format($$ values (%L::uuid) $$, current_setting('mvr.digital_id')),
  'merchant of another org can SELECT a digital card via cards_merchant_validate_read'
);

-- ============================================================================
-- 3. An authenticated user with no roles can read physical cards (activation
--    flow when signed in but not yet a cardholder of the card in hand).
-- ============================================================================

select makerkit.authenticate_as('mvr-rando');

select results_eq(
  format(
    $$ select id from public.cards where id = %L $$,
    current_setting('mvr.physical_id')
  ),
  format($$ values (%L::uuid) $$, current_setting('mvr.physical_id')),
  'role-less authenticated user can still SELECT a physical card via cards_public_read_for_activation'
);

-- ============================================================================
-- 4. An authenticated user with no roles must NOT read digital cards. The
--    only legitimate path is the SECURITY DEFINER claim-token RPC.
-- ============================================================================

select is_empty(
  format(
    $$ select id from public.cards where id = %L $$,
    current_setting('mvr.digital_id')
  ),
  'role-less authenticated user cannot SELECT a digital card after the policy narrowing'
);

-- ============================================================================
-- 5. Anon can read physical cards (column-restricted GRANT still applies on
--    top — covered by cards-anon-column-restrictions.test.sql).
-- ============================================================================

set local role anon;

select results_eq(
  format(
    $$ select id from public.cards where id = %L $$,
    current_setting('mvr.physical_id')
  ),
  format($$ values (%L::uuid) $$, current_setting('mvr.physical_id')),
  'anon can SELECT a physical card via cards_public_read_for_activation'
);

-- ============================================================================
-- 6. Anon must NOT read digital cards (also covered by the column GRANT, but
--    the row policy is now a second line of defence).
-- ============================================================================

select is_empty(
  format(
    $$ select id from public.cards where id = %L $$,
    current_setting('mvr.digital_id')
  ),
  'anon cannot SELECT a digital card after the policy narrowing'
);

select * from finish();
ROLLBACK;
