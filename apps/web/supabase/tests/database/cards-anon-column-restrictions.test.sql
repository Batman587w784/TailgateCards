BEGIN;
create extension "basejump-supabase_test_helpers" version '0.0.6';

select plan(9);

-- Regression test for the cards_public_read_for_activation policy + GRANT
-- combination. The /activate flow needs anon to look up a physical card by
-- (batch_id, card_number); it must NOT be able to read sensitive columns —
-- most importantly claim_token (anon enumeration would let an attacker steal
-- every live digital-card claim link), plus buyer_email / cardholder_id /
-- stripe_* fields.
--
-- The seed below pre-creates one digital card so an attacker that *did* have
-- broad SELECT would actually return data; without rows the assertion would
-- still pass once column-level GRANTs are enforced (PostgreSQL checks privs
-- before scanning), but with rows we also catch a regression where the policy
-- accidentally hides the leak by returning zero rows.

set local role service_role;

select tests.create_supabase_user('anon-leak-admin', 'anon-leak-admin@test.com');

select makerkit.authenticate_as('anon-leak-admin');
select public.create_team_account('Anon Leak Org');

set local role service_role;

do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from public.accounts where name = 'Anon Leak Org' limit 1;

  insert into public.organization_profiles (account_id, organization_name, share_per_card_cents)
  values (v_org_id, 'Anon Leak Org', 1000);

  insert into public.cards (
    organization_id, card_type, status,
    claim_token, digital_card_number,
    buyer_email, purchased_at, paid_at,
    price_cents, payment_type, stripe_payment_intent_id, stripe_customer_email
  ) values (
    v_org_id, 'digital', 'paid',
    'leaktest-token-abcdef0123456789', 1,
    'buyer@leaktest.com', now(), now(),
    2500, 'stripe', 'pi_leaktest', 'buyer@leaktest.com'
  );
end $$;

set local role anon;

-- ============================================================================
-- Negative cases: anon must NOT be able to SELECT sensitive columns.
-- SQLSTATE 42501 = insufficient_privilege.
-- ============================================================================

select throws_ok(
  $$ select claim_token from public.cards limit 1 $$,
  '42501', null,
  'anon cannot SELECT cards.claim_token'
);

select throws_ok(
  $$ select buyer_email from public.cards limit 1 $$,
  '42501', null,
  'anon cannot SELECT cards.buyer_email'
);

select throws_ok(
  $$ select purchased_at from public.cards limit 1 $$,
  '42501', null,
  'anon cannot SELECT cards.purchased_at'
);

select throws_ok(
  $$ select digital_card_number from public.cards limit 1 $$,
  '42501', null,
  'anon cannot SELECT cards.digital_card_number'
);

select throws_ok(
  $$ select stripe_payment_intent_id from public.cards limit 1 $$,
  '42501', null,
  'anon cannot SELECT cards.stripe_payment_intent_id'
);

select throws_ok(
  $$ select stripe_customer_email from public.cards limit 1 $$,
  '42501', null,
  'anon cannot SELECT cards.stripe_customer_email'
);

select throws_ok(
  $$ select cardholder_id from public.cards limit 1 $$,
  '42501', null,
  'anon cannot SELECT cards.cardholder_id'
);

-- ============================================================================
-- Positive case: the activation flow's column set must still work.
-- Mirrors apps/web/app/activate/_lib/server/card-activation.loader.ts:121-131.
-- ============================================================================

select lives_ok(
  $$ select id, card_number, status, price_cents, organization_id from public.cards limit 1 $$,
  'anon can still SELECT the columns the /activate loader needs'
);

-- Regression: the /activate loader and verifyCardCode action filter cards by
-- batch_id. PostgreSQL requires SELECT privilege on every column referenced
-- in a query, including the WHERE clause — so anon must be able to read
-- batch_id even though it isn't projected. See migration
-- 20260519031554_grant-anon-select-batch-id-on-cards.sql.
select lives_ok(
  $$ select id, card_number, status, price_cents, organization_id
       from public.cards
      where batch_id is not null
      limit 1 $$,
  'anon can SELECT activate columns while filtering by batch_id'
);

select * from finish();
ROLLBACK;
