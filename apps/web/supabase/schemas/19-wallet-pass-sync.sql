/*
 * -------------------------------------------------------
 * Section: Wallet Pass Sync
 * Durable outbox + Apple PassKit registration store that lets already-saved
 * wallet passes reflect later changes to expiry, discounts, org/batch names,
 * and card status. Triggers only INSERT into the queue (no outbound HTTP), so
 * pg_net is not required. A Vercel-Cron worker drains the queue.
 * -------------------------------------------------------
 */

-- One row per card ever offered to a wallet.
create table if not exists public.wallet_passes (
  card_id uuid primary key references public.cards(id) on delete cascade,
  serial_number text not null unique,
  organization_id uuid not null references public.accounts(id) on delete cascade,
  content_tag timestamptz not null default now(),
  google_save_requested_at timestamptz,
  apple_pass_issued_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

comment on table public.wallet_passes is 'One row per card offered to Apple/Google Wallet; content_tag is the Apple "last updated" marker bumped on every change.';
comment on column public.wallet_passes.content_tag is 'Bumped to now() whenever pass content changes; served as Apple Last-Modified / passesUpdatedSince tag.';
comment on column public.wallet_passes.google_save_requested_at is 'Set when a Google save URL was generated for this card; runtime google object id is {issuerId}.{serial_number}.';

alter table public.wallet_passes enable row level security;
revoke all on public.wallet_passes from authenticated, service_role;
grant select, insert, update, delete on table public.wallet_passes to service_role;

create index if not exists ix_wallet_passes_org on public.wallet_passes (organization_id);
create index if not exists ix_wallet_passes_google
  on public.wallet_passes (organization_id) where google_save_requested_at is not null;

create trigger wallet_passes_set_timestamps
before insert or update on public.wallet_passes
for each row execute function public.trigger_set_timestamps();

-- Apple PassKit device <-> pass registration store.
create table if not exists public.wallet_pass_registrations (
  device_library_identifier text not null,
  serial_number text not null references public.wallet_passes(serial_number) on delete cascade,
  pass_type_identifier text not null,
  push_token text not null,
  created_at timestamptz,
  updated_at timestamptz,
  primary key (device_library_identifier, serial_number)
);

comment on table public.wallet_pass_registrations is 'Apple PassKit device registrations: which devices hold which pass serials, and the APNs push token to notify.';

alter table public.wallet_pass_registrations enable row level security;
revoke all on public.wallet_pass_registrations from authenticated, service_role;
grant select, insert, update, delete on table public.wallet_pass_registrations to service_role;

create index if not exists ix_wallet_pass_registrations_serial
  on public.wallet_pass_registrations (serial_number);

create trigger wallet_pass_registrations_set_timestamps
before insert or update on public.wallet_pass_registrations
for each row execute function public.trigger_set_timestamps();

-- Durable outbox of pending sync jobs.
create table if not exists public.wallet_sync_queue (
  id uuid primary key default extensions.uuid_generate_v4(),
  scope text not null check (scope in ('card', 'organization')),
  card_id uuid references public.cards(id) on delete cascade,
  organization_id uuid references public.accounts(id) on delete cascade,
  reason text not null check (reason in ('expiry', 'discounts', 'org_profile', 'status')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  attempts integer not null default 0,
  last_error text,
  not_before timestamptz not null default now(),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

comment on table public.wallet_sync_queue is 'Outbox of wallet pass sync jobs, drained by the /api/wallet/sync worker.';

alter table public.wallet_sync_queue enable row level security;
revoke all on public.wallet_sync_queue from authenticated, service_role;
grant select, insert, update, delete on table public.wallet_sync_queue to service_role;

-- Coalesce duplicate pending jobs. NULLS NOT DISTINCT is required (PG15+): card_id
-- and organization_id are nullable and default Postgres treats NULL as distinct,
-- which would silently defeat coalescing.
create unique index if not exists uq_wallet_sync_queue_pending
  on public.wallet_sync_queue (scope, card_id, organization_id, reason)
  nulls not distinct
  where status = 'pending';

create index if not exists ix_wallet_sync_queue_drain
  on public.wallet_sync_queue (status, not_before) where status = 'pending';

-- Enqueue helpers ---------------------------------------------------------

create or replace function public.enqueue_wallet_sync_card(p_card_id uuid, p_reason text)
returns void language sql security definer set search_path = '' as $$
  insert into public.wallet_sync_queue (scope, card_id, reason)
  values ('card', p_card_id, p_reason)
  on conflict do nothing;
$$;

create or replace function public.enqueue_wallet_sync_org(p_org_id uuid, p_reason text)
returns void language sql security definer set search_path = '' as $$
  insert into public.wallet_sync_queue (scope, organization_id, reason)
  values ('organization', p_org_id, p_reason)
  on conflict do nothing;
$$;

-- cards: expiry + status changes -----------------------------------------

create or replace function public.tg_cards_wallet_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.expires_at is distinct from old.expires_at then
    perform public.enqueue_wallet_sync_card(new.id, 'expiry');
  end if;
  if new.status is distinct from old.status
     and new.status in ('cancelled', 'expired') then
    perform public.enqueue_wallet_sync_card(new.id, 'status');
  end if;
  return new;
end;
$$;

create trigger cards_wallet_sync
after update on public.cards
for each row execute function public.tg_cards_wallet_sync();

-- discounts: fan out to every partnered org ------------------------------

create or replace function public.tg_discounts_wallet_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_merchant_id uuid := coalesce(new.merchant_id, old.merchant_id);
begin
  perform public.enqueue_wallet_sync_org(p.organization_id, 'discounts')
  from public.organization_merchant_partnerships p
  where p.merchant_id = v_merchant_id;
  return coalesce(new, old);
end;
$$;

create trigger discounts_wallet_sync
after insert or update or delete on public.discounts
for each row execute function public.tg_discounts_wallet_sync();

-- partnerships: org discount set changed ---------------------------------

create or replace function public.tg_partnerships_wallet_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enqueue_wallet_sync_org(
    coalesce(new.organization_id, old.organization_id), 'discounts');
  return coalesce(new, old);
end;
$$;

create trigger partnerships_wallet_sync
after insert or delete on public.organization_merchant_partnerships
for each row execute function public.tg_partnerships_wallet_sync();

-- organization_profiles: name change ------------------------------------

create or replace function public.tg_org_profiles_wallet_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.organization_name is distinct from old.organization_name then
    perform public.enqueue_wallet_sync_org(new.account_id, 'org_profile');
  end if;
  return new;
end;
$$;

create trigger org_profiles_wallet_sync
after update on public.organization_profiles
for each row execute function public.tg_org_profiles_wallet_sync();

-- batches: name change ---------------------------------------------------

create or replace function public.tg_batches_wallet_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.name is distinct from old.name then
    perform public.enqueue_wallet_sync_org(new.organization_id, 'org_profile');
  end if;
  return new;
end;
$$;

create trigger batches_wallet_sync
after update on public.batches
for each row execute function public.tg_batches_wallet_sync();

-- Claim RPC + backfill function -------------------------------------------

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
