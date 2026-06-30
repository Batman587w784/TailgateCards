begin;
create extension "basejump-supabase_test_helpers" version '0.0.6';
select plan(3);

-- ============================================================
-- Fixtures
-- ============================================================

-- Create a user and one org account
select tests.create_supabase_user('ws-claim-owner', 'ws-claim-owner@test.com');

select makerkit.authenticate_as('ws-claim-owner');
select public.create_team_account('WS Claim Org');

do $$
declare v_id uuid;
begin
  select id into v_id from public.accounts where name = 'WS Claim Org' limit 1;
  perform set_config('ws.org_id', v_id::text, true);
end $$;

-- Switch to service_role for queue operations (claim RPC is only granted to service_role)
set local role service_role;

-- Clear any queue rows produced by fixture triggers so we get a clean count
delete from public.wallet_sync_queue;

insert into public.wallet_sync_queue (scope, organization_id, reason)
  values ('organization', current_setting('ws.org_id')::uuid, 'discounts');

-- ============================================================
-- 1. claim returns the pending job and flips it to processing
-- ============================================================
select is(
  (select count(*)::int from public.claim_wallet_sync_jobs(10)),
  1, 'claim returns one pending job');

select is(
  (select status from public.wallet_sync_queue
   where organization_id = current_setting('ws.org_id')::uuid),
  'processing', 'claimed job is now processing');

-- ============================================================
-- 2. a second claim returns nothing (already claimed)
-- ============================================================
select is(
  (select count(*)::int from public.claim_wallet_sync_jobs(10)),
  0, 'already-claimed job is not returned again');

select * from finish();
rollback;
