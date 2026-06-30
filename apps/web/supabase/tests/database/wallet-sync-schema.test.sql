begin;
create extension "basejump-supabase_test_helpers" version '0.0.6';

select plan(9);

-- tables exist
select has_table('public', 'wallet_passes', 'wallet_passes table exists');
select has_table('public', 'wallet_pass_registrations', 'wallet_pass_registrations table exists');
select has_table('public', 'wallet_sync_queue', 'wallet_sync_queue table exists');

-- RLS enabled
select is(
  (select relrowsecurity from pg_class where oid = 'public.wallet_passes'::regclass),
  true, 'wallet_passes has RLS enabled');
select is(
  (select relrowsecurity from pg_class where oid = 'public.wallet_pass_registrations'::regclass),
  true, 'wallet_pass_registrations has RLS enabled');
select is(
  (select relrowsecurity from pg_class where oid = 'public.wallet_sync_queue'::regclass),
  true, 'wallet_sync_queue has RLS enabled');

-- worker/service-role only: authenticated holds zero table privileges, so it can
-- neither read nor write the outbox (defense in depth on top of RLS).
select table_privs_are(
  'public', 'wallet_sync_queue', 'authenticated', array[]::text[],
  'authenticated has no privileges on wallet_sync_queue');

-- coalescing unique index exists
select isnt_empty(
  $$ select 1 from pg_indexes
     where schemaname='public' and indexname='uq_wallet_sync_queue_pending' $$,
  'pending coalescing index exists');

-- serial uniqueness
select col_is_unique('public', 'wallet_passes', 'serial_number',
  'wallet_passes.serial_number is unique');

select * from finish();
rollback;
