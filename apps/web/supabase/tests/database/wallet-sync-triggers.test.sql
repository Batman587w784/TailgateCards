begin;
create extension "basejump-supabase_test_helpers" version '0.0.6';
select plan(5);

-- ============================================================
-- Fixtures
-- ============================================================

-- Create users
select tests.create_supabase_user('ws-org-owner',   'ws-org-owner@test.com');
select tests.create_supabase_user('ws-merch-owner', 'ws-merch-owner@test.com');

-- Create team accounts and capture their IDs into session GUCs
select makerkit.authenticate_as('ws-org-owner');
select public.create_team_account('WS Org');

do $$
declare v_id uuid;
begin
  select id into v_id from public.accounts where name = 'WS Org' limit 1;
  perform set_config('ws.org_id', v_id::text, true);
end $$;

select makerkit.authenticate_as('ws-merch-owner');
select public.create_team_account('WS Merchant');

do $$
declare v_id uuid;
begin
  select id into v_id from public.accounts where name = 'WS Merchant' limit 1;
  perform set_config('ws.merch_id', v_id::text, true);
end $$;

select makerkit.authenticate_as('ws-org-owner');
select public.create_team_account('WS Org Two');

do $$
declare v_id uuid;
begin
  select id into v_id from public.accounts where name = 'WS Org Two' limit 1;
  perform set_config('ws.org2_id', v_id::text, true);
end $$;

-- All DML below uses service_role to bypass RLS
set local role service_role;

-- Card for WS Org (physical requires card_number integer)
insert into public.cards (id, organization_id, card_type, status, expires_at, card_number)
  values ('00000000-0000-0000-0000-0000000000c1',
          (current_setting('ws.org_id'))::uuid, 'physical', 'activated',
          now() + interval '30 days', 1);

-- Wallet pass row for the card
insert into public.wallet_passes (card_id, serial_number, organization_id)
  values ('00000000-0000-0000-0000-0000000000c1', 'D-000001',
          (current_setting('ws.org_id'))::uuid);

-- ============================================================
-- 1. expiry change enqueues card/expiry
-- ============================================================
update public.cards set expires_at = now() + interval '60 days'
  where id = '00000000-0000-0000-0000-0000000000c1';

select is(
  (select count(*)::int from public.wallet_sync_queue
   where scope='card' and reason='expiry'
   and card_id='00000000-0000-0000-0000-0000000000c1' and status='pending'),
  1, 'expiry change enqueues one card/expiry job');

-- ============================================================
-- 2. coalescing: a second expiry change does NOT create a duplicate pending row
-- ============================================================
update public.cards set expires_at = now() + interval '90 days'
  where id = '00000000-0000-0000-0000-0000000000c1';

select is(
  (select count(*)::int from public.wallet_sync_queue
   where scope='card' and reason='expiry'
   and card_id='00000000-0000-0000-0000-0000000000c1' and status='pending'),
  1, 'duplicate expiry change is coalesced to one pending job');

-- ============================================================
-- 3. status -> cancelled enqueues card/status
-- ============================================================
update public.cards set status='cancelled'
  where id='00000000-0000-0000-0000-0000000000c1';

select is(
  (select count(*)::int from public.wallet_sync_queue
   where scope='card' and reason='status'
   and card_id='00000000-0000-0000-0000-0000000000c1' and status='pending'),
  1, 'status change enqueues one card/status job');

-- ============================================================
-- 4. discount insert fans out to partnered orgs
-- ============================================================
-- Partnership between WS Org and WS Merchant
insert into public.organization_merchant_partnerships (organization_id, merchant_id)
  values ((current_setting('ws.org_id'))::uuid,
          (current_setting('ws.merch_id'))::uuid)
  on conflict do nothing;

-- Clear queue rows produced by the partnership insert so we get a clean count
delete from public.wallet_sync_queue
  where scope='organization' and reason='discounts'
  and organization_id=(current_setting('ws.org_id'))::uuid;

-- Insert a discount scoped to the merchant
insert into public.discounts (id, merchant_id, organization_id, title, valid_from, is_active)
  values ('00000000-0000-0000-0000-0000000000d1',
          (current_setting('ws.merch_id'))::uuid,
          (current_setting('ws.org_id'))::uuid,
          'Test Discount', now(), true);

select is(
  (select count(*)::int from public.wallet_sync_queue
   where scope='organization' and reason='discounts'
   and organization_id=(current_setting('ws.org_id'))::uuid and status='pending'),
  1, 'discount insert enqueues one organization/discounts job per partnered org');

-- ============================================================
-- 5. partnership insert enqueues organization/discounts
-- ============================================================
-- Clear queue first
delete from public.wallet_sync_queue;

insert into public.organization_merchant_partnerships (organization_id, merchant_id)
  values ((current_setting('ws.org2_id'))::uuid,
          (current_setting('ws.merch_id'))::uuid)
  on conflict do nothing;

select isnt_empty(
  $$ select 1 from public.wallet_sync_queue
     where scope='organization' and reason='discounts'
     and organization_id = (current_setting('ws.org2_id'))::uuid $$,
  'partnership insert enqueues organization/discounts');

select * from finish();
rollback;
