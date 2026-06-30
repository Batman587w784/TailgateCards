BEGIN;
create extension "basejump-supabase_test_helpers" version '0.0.6';

select no_plan();

-- Set up: super-admin user creates an organization, distributor, and org profile.
-- We bypass RLS via the service_role wherever it's simpler than threading auth.

select tests.create_supabase_user('m6-admin', 'm6-admin@test.com');
select tests.create_supabase_user('m6-dist',  'm6-dist@test.com');

-- Create an organization (team account).
select makerkit.authenticate_as('m6-admin');
select public.create_team_account('M6 Org');

-- Capture the org id we just created.
do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from public.accounts where name = 'M6 Org' limit 1;
  perform set_config('m6.org_id', v_org_id::text, true);
end $$;

-- Switch to service_role so we can seed organization_profiles + distributor membership
-- and exercise the RPCs without fighting RLS in the test harness.
set local role service_role;

insert into public.organization_profiles (account_id, organization_name, share_per_card_cents)
values ((current_setting('m6.org_id'))::uuid, 'M6 Org', 1500);

-- Distributor membership row so the share_slug trigger fires.
insert into public.accounts_memberships (
  account_id, user_id, account_role
) values (
  (current_setting('m6.org_id'))::uuid,
  tests.get_supabase_uid('m6-dist'),
  'distributor'
);

-- ============================================================================
-- next_digital_card_number is monotonic per-org
-- ============================================================================

select is(
  public.next_digital_card_number((current_setting('m6.org_id'))::uuid),
  1,
  'first digital card number for an org is 1'
);

select is(
  public.next_digital_card_number((current_setting('m6.org_id'))::uuid),
  2,
  'subsequent calls increment per-org'
);

select is(
  public.next_digital_card_number((current_setting('m6.org_id'))::uuid),
  3,
  'monotonic without gaps within a single transaction'
);

-- ============================================================================
-- create_digital_card creates a card and is idempotent on payment_intent_id
-- ============================================================================

do $$
declare
  v_first_card_id uuid;
  v_second_card_id uuid;
begin
  select card_id into v_first_card_id
  from public.create_digital_card(
    p_organization_id   := (current_setting('m6.org_id'))::uuid,
    p_distributor_id    := tests.get_supabase_uid('m6-dist'),
    p_payment_intent_id := 'pi_test_one',
    p_buyer_email       := 'buyer@test.com',
    p_price_cents       := 2500
  );

  -- Same payment_intent_id must return the same card id, not a duplicate.
  select card_id into v_second_card_id
  from public.create_digital_card(
    p_organization_id   := (current_setting('m6.org_id'))::uuid,
    p_distributor_id    := tests.get_supabase_uid('m6-dist'),
    p_payment_intent_id := 'pi_test_one',
    p_buyer_email       := 'buyer@test.com',
    p_price_cents       := 2500
  );

  if v_first_card_id is null then
    raise exception 'create_digital_card returned null card_id on first call';
  end if;

  if v_first_card_id <> v_second_card_id then
    raise exception 'create_digital_card not idempotent: % vs %', v_first_card_id, v_second_card_id;
  end if;

  perform set_config('m6.first_card_id', v_first_card_id::text, true);
end $$;

select isnt_empty(
  $$ select 1 from public.cards
     where stripe_payment_intent_id = 'pi_test_one'
       and card_type = 'digital'
       and status = 'paid' $$,
  'create_digital_card inserts a digital card with status=paid'
);

select is(
  (select count(*)::int from public.cards where stripe_payment_intent_id = 'pi_test_one'),
  1,
  'idempotent re-call did not create a duplicate row'
);

-- ============================================================================
-- get_digital_card_for_activation: token round-trips, unknown token returns empty
-- ============================================================================

do $$
declare
  v_token text;
begin
  select claim_token into v_token from public.cards
   where id = (current_setting('m6.first_card_id'))::uuid;

  if v_token is null then
    raise exception 'expected claim_token to be populated for the digital card';
  end if;

  perform set_config('m6.claim_token', v_token, true);
end $$;

set local role anon;

select isnt_empty(
  format(
    $$ select id from public.get_digital_card_for_activation(%L) $$,
    current_setting('m6.claim_token')
  ),
  'anon can resolve a digital card by claim_token via the SECURITY DEFINER RPC'
);

select is_empty(
  $$ select id from public.get_digital_card_for_activation('totally-bogus-token-xyz') $$,
  'unknown token returns no rows'
);

-- ============================================================================
-- activate_digital_card: happy path, then already-claimed errors
-- ============================================================================

-- The function uses get_user_personal_account_id(), so we need to be
-- authenticated as a buyer (not service_role).
select tests.create_supabase_user('m6-buyer', 'm6-buyer@test.com');
select makerkit.authenticate_as('m6-buyer');

-- First activation should return a cards row with status='activated'.
select results_eq(
  format(
    $$ select status::text
       from public.activate_digital_card(%L, 365) $$,
    current_setting('m6.claim_token')
  ),
  $$ values ('activated'::text) $$,
  'activate_digital_card returns the card with status=activated on first claim'
);

select is(
  (select status::text from public.cards
    where id = (current_setting('m6.first_card_id'))::uuid),
  'activated',
  'card status flips to activated after activate_digital_card'
);

-- Second call by the same user must hit the preflight one-card-per-cardholder
-- guard (audit #6) and raise a clean message — not the 23505 from
-- ix_cards_cardholder_unique.
select throws_ok(
  format(
    $$ select * from public.activate_digital_card(%L, 365) $$,
    current_setting('m6.claim_token')
  ),
  'You already have an active card',
  'activate_digital_card preflights one-card-per-cardholder before touching the unique index'
);

-- Switch back to service_role for the final RPC checks.
set local role service_role;

-- ============================================================================
-- get_org_admin_card_type_split returns the expected counts/revenue
-- ============================================================================

select results_eq(
  format(
    $$ select
         (split->>'digital_total')::int,
         (split->>'digital_activated')::int,
         (split->>'digital_revenue_cents')::bigint
       from public.get_org_admin_card_type_split(%L) as split $$,
    current_setting('m6.org_id')
  ),
  $$ values (1::int, 1::int, 1500::bigint) $$,
  'split RPC counts the activated digital card and applies share_per_card_cents'
);

-- ============================================================================
-- Distributor RPCs use per-org share_per_card_cents and emit a D-NNNNNN
-- message for digital activations.
-- ============================================================================

select tests.create_supabase_user('m6-admin2', 'm6-admin2@test.com');
select tests.create_supabase_user('m6-dist2',  'm6-dist2@test.com');

select makerkit.authenticate_as('m6-admin2');
select public.create_team_account('M6 Org Two');

set local role service_role;

do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from public.accounts where name = 'M6 Org Two' limit 1;
  perform set_config('m6.org2_id', v_org_id::text, true);

  insert into public.organization_profiles (account_id, organization_name, share_per_card_cents)
  values (v_org_id, 'M6 Org Two', 1250);

  insert into public.accounts_memberships (account_id, user_id, account_role)
  values (v_org_id, tests.get_supabase_uid('m6-dist2'), 'distributor');

  -- Direct insert keeps the test focused on what the distributor RPCs see;
  -- the create→pay→activate path is exercised earlier in this file.
  insert into public.cards (
    organization_id, distributor_id, card_type, status,
    claim_token, digital_card_number,
    price_cents, payment_type,
    purchased_at, paid_at, activated_at
  ) values (
    v_org_id,
    tests.get_supabase_uid('m6-dist2'),
    'digital',
    'activated',
    'token-org2-card1',
    1,
    2500,
    'stripe',
    now(), now(), now()
  );
end $$;

-- The distributor RPCs gate on auth.uid() = p_distributor_id, so call them
-- as the distributor — not as service_role.
select makerkit.authenticate_as('m6-dist2');

select results_eq(
  format(
    $$ select total_earnings_cents from public.get_distributor_revenue_stats(%L) $$,
    tests.get_supabase_uid('m6-dist2')
  ),
  $$ values (1250::bigint) $$,
  'distributor revenue sums per-card share_per_card_cents (1250 from one activated digital card)'
);

select results_eq(
  format(
    $$ select revenue_cents
       from public.get_distributor_sales_over_time(%L, 6)
       where date_trunc('month', now())::date = month_start $$,
    tests.get_supabase_uid('m6-dist2')
  ),
  $$ values (1250::bigint) $$,
  'distributor sales-over-time current-month row uses share_per_card_cents'
);

select ok(
  exists(
    select 1
      from public.get_distributor_recent_activities(tests.get_supabase_uid('m6-dist2'), 20) a
     where a.message like '%D-000001%'
  ),
  'distributor recent activities formats digital activations as D-NNNNNN'
);

-- ============================================================================
-- create_digital_card validates the (distributor, organization) pair
-- (M6 audit #4 — webhook trust-boundary fix)
-- ============================================================================

set local role service_role;

-- Cross-org: m6-dist2 is a distributor of M6 Org Two, not M6 Org. Trying to
-- mint a card for M6 Org with that distributor must raise.
select throws_like(
  format(
    $$ select * from public.create_digital_card(
         p_organization_id   := %L,
         p_distributor_id    := %L,
         p_payment_intent_id := 'pi_audit4_crossorg',
         p_buyer_email       := 'attacker@test.com',
         p_price_cents       := 2500
       ) $$,
    current_setting('m6.org_id'),
    tests.get_supabase_uid('m6-dist2')
  ),
  '%is not a member of organization%with role distributor%',
  'create_digital_card rejects a distributor not enrolled in the target org'
);

-- Non-distributor: m6-admin owns M6 Org but holds no distributor membership.
-- Even with a valid org id, they must not be allowed to mint cards.
select throws_like(
  format(
    $$ select * from public.create_digital_card(
         p_organization_id   := %L,
         p_distributor_id    := %L,
         p_payment_intent_id := 'pi_audit4_nondist',
         p_buyer_email       := 'attacker@test.com',
         p_price_cents       := 2500
       ) $$,
    current_setting('m6.org_id'),
    tests.get_supabase_uid('m6-admin')
  ),
  '%is not a member of organization%with role distributor%',
  'create_digital_card rejects a user without a distributor membership'
);

-- No row was written by either rejected call.
select is_empty(
  $$ select 1 from public.cards
     where stripe_payment_intent_id in ('pi_audit4_crossorg', 'pi_audit4_nondist') $$,
  'rejected create_digital_card calls do not insert a card row'
);

SELECT *
FROM finish();

ROLLBACK;
