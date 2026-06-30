-- Atomically claim pending jobs (skip-locked), flipping them to processing.
create or replace function public.claim_wallet_sync_jobs(p_limit integer default 100)
returns setof public.wallet_sync_queue
language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.wallet_sync_queue q
     set status = 'processing',
         attempts = q.attempts + 1,
         processed_at = now()
   where q.id in (
     select id from public.wallet_sync_queue
      where status = 'pending' and not_before <= now()
      order by created_at
      limit p_limit
      for update skip locked
   )
  returning q.*;
end;
$$;

revoke all on function public.claim_wallet_sync_jobs(integer) from public, authenticated;
grant execute on function public.claim_wallet_sync_jobs(integer) to service_role;

-- Backfill wallet_passes for already-activated cards whose holder optimistically
-- saved to Google Wallet. Serial number replicates lib/cards/format-display-code.ts.
-- Idempotent via ON CONFLICT.
create or replace function public.backfill_wallet_passes()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  with eligible as (
    select c.id as card_id,
           c.organization_id,
           case
             when c.card_type = 'digital'
               then 'D-' || lpad(c.digital_card_number::text, 6, '0')
             else org.card_prefix || '-' || b.prefix || '-' || c.card_number::text
           end as serial_number,
           cp.google_wallet_added_at
      from public.cards c
      join public.accounts org on org.id = c.organization_id
      left join public.batches b on b.id = c.batch_id
      join public.cardholder_profiles cp on cp.account_id = c.cardholder_id
     where c.status = 'activated'
       and cp.google_wallet_added_at is not null
       and (c.card_type = 'digital' or (org.card_prefix is not null and b.prefix is not null))
  )
  insert into public.wallet_passes
    (card_id, serial_number, organization_id, google_save_requested_at)
  select card_id, serial_number, organization_id, google_wallet_added_at
    from eligible
  on conflict (card_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.backfill_wallet_passes() from public, authenticated;
grant execute on function public.backfill_wallet_passes() to service_role;
