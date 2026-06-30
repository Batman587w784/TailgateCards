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
