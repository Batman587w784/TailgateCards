# Wallet Pass Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Propagate card data changes (expiry, discount list, org/batch name, card status) to already-saved Apple & Google wallet passes within ~1 minute.

**Architecture:** DB triggers enqueue change events into a durable `wallet_sync_queue` outbox (INSERT-only, no HTTP from Postgres). A Vercel-Cron-driven worker route (`/api/wallet/sync`, ~1 min) drains the queue: it PATCHes Google Wallet objects directly (works for already-saved passes) and sends APNs pushes to Apple devices registered via a new PassKit Web Service (only passes issued *after* this ships can sync — they embed a `webServiceURL` + HMAC auth token).

**Tech Stack:** Next.js 16 route handlers (`enhanceRouteHandler`), Supabase/Postgres (declarative schemas + pgTAP), `passkit-generator` (existing), `jose` (existing, for APNs ES256 JWT + Google OAuth assertion), `node:crypto` (HMAC), `node:http2` (APNs), global `fetch` (Google REST). **No new npm dependencies.**

**Spec:** `docs/superpowers/specs/2026-06-10-wallet-pass-sync-design.md`

**Refinements vs spec (authoritative here):**
1. `wallet_passes` has **no `google_object_id`** column — the id is deterministic (`{GOOGLE_WALLET_ISSUER_ID}.{serial}`), computed at runtime; `google_save_requested_at` is the "offered to Google" flag.
2. Worker is a **GET** handler guarded by `Authorization: Bearer {CRON_SECRET}` — Vercel Cron's native mechanism.

**Testing conventions (repo reality — no JS unit runner exists):**
- DB logic → **pgTAP** in `apps/web/supabase/tests/database/`, run with `pnpm --filter web supabase:test`.
- HTTP surface & flows → **Playwright** in `apps/e2e/tests/`, run with `pnpm --filter e2e test` (or the repo's e2e script).
- Every task ends with `pnpm typecheck` and a commit. Run `pnpm lint:fix` + `pnpm format:fix` before each commit.

---

## File Structure

**Database (declarative-first):**
- Create `apps/web/supabase/schemas/19-wallet-pass-sync.sql` — 3 tables, indexes, RLS, enqueue trigger functions + triggers, `claim_wallet_sync_jobs` RPC, `backfill_wallet_passes` function.
- Generated migration in `apps/web/supabase/migrations/` (via `supabase:db:diff`).
- Tests: `apps/web/supabase/tests/database/wallet-sync-*.test.sql`.

**Shared server utilities (`apps/web/app/activate/_lib/server/`):**
- Create `pass-auth-token.ts` — HMAC token generate/verify.
- Create `wallet-pass.repository.ts` — upsert/lookup `wallet_passes`, registrations, queue helpers.
- Create `google-wallet-update.service.ts` — OAuth token + `PATCH genericObject`.
- Create `apns.service.ts` — token-based APNs HTTP/2 push.
- Modify `apple-wallet.service.ts` — add `webServiceURL` + `authenticationToken`.
- Modify `google-wallet.service.ts` — export `buildTextModules`/types for reuse by the updater.
- Modify `resolve-card.ts` — return `cardId` + `organizationId`.
- Modify `wallet.actions.ts` — upsert `wallet_passes` on Google save.

**Route handlers (`apps/web/app/api/wallet/`):**
- Modify `apple/[code]/route.ts` — upsert `wallet_passes` on pkpass download.
- Create `apple/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber]/route.ts` — POST register / DELETE unregister.
- Create `apple/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/route.ts` — GET passesUpdatedSince.
- Create `apple/v1/passes/[passTypeIdentifier]/[serialNumber]/route.ts` — GET pass re-fetch.
- Create `apple/v1/log/route.ts` — POST log.
- Create `sync/route.ts` — GET worker (CRON_SECRET).

**Errors / config:**
- Modify `apps/web/app/activate/_lib/wallet-errors.ts` — add codes.
- Create/modify `vercel.json` (repo root) — cron entry.
- Modify `apps/web/.env.example` (or `.env`) — new vars.

---

## Phase 0 — Prerequisites (operator, before coding)

These are documented in the spec's "Apple Operator Provisioning" section. Implementation can proceed against local env values; production needs the real `.p8`.

- [ ] **Step 1: Add local env vars**

Add to `apps/web/.env` (and document in `.env.example` in Task 18). For local dev the APNs/Google values can be placeholders — local sync calls will no-op/log when unconfigured.

```bash
WALLET_PASS_AUTH_SECRET=dev-hmac-secret-change-me
CRON_SECRET=dev-cron-secret-change-me
APNS_AUTH_KEY=
APNS_KEY_ID=
# APNS team id reuses APPLE_WALLET_TEAM_ID; APNS topic reuses APPLE_WALLET_PASS_TYPE_ID
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/.env.example 2>/dev/null; git commit --allow-empty -m "chore(wallet): reserve env vars for pass sync" || true
```

---

## Phase 1 — Database foundation

### Task 1: Create the three sync tables

**Files:**
- Create: `apps/web/supabase/schemas/19-wallet-pass-sync.sql`
- Test: `apps/web/supabase/tests/database/wallet-sync-schema.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `apps/web/supabase/tests/database/wallet-sync-schema.test.sql`:

```sql
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

-- authenticated cannot read (worker/service-role only): no SELECT policy for authenticated
set local role authenticated;
select is_empty(
  $$ select 1 from public.wallet_sync_queue $$,
  'authenticated sees no wallet_sync_queue rows (no policy)');
set local role service_role;

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
```

- [ ] **Step 2: Run it — expect failure**

Run: `pnpm --filter web supabase:test`
Expected: FAIL (tables don't exist).

- [ ] **Step 3: Create the schema file**

Create `apps/web/supabase/schemas/19-wallet-pass-sync.sql`:

```sql
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
```

- [ ] **Step 4: Reset DB and run tests**

Run: `pnpm supabase:web:reset && pnpm --filter web supabase:test`
Expected: the 9 schema assertions PASS.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm format:fix
git add apps/web/supabase/schemas/19-wallet-pass-sync.sql apps/web/supabase/tests/database/wallet-sync-schema.test.sql
git commit -m "feat(wallet): add wallet pass sync tables (passes, registrations, queue)"
```

---

### Task 2: Enqueue triggers (change detection)

**Files:**
- Modify: `apps/web/supabase/schemas/19-wallet-pass-sync.sql` (append)
- Test: `apps/web/supabase/tests/database/wallet-sync-triggers.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `apps/web/supabase/tests/database/wallet-sync-triggers.test.sql`. It exercises: expiry change enqueues `card/expiry`; status→cancelled enqueues `card/status`; a discount insert fans out one `organization/discounts` job per partnered org; coalescing keeps duplicates to one pending row.

```sql
begin;
create extension "basejump-supabase_test_helpers" version '0.0.6';
select plan(5);
set local role service_role;

-- minimal fixtures: an org account, a card with a wallet_passes row
insert into public.accounts (id, name, is_personal_account, card_prefix)
  values ('00000000-0000-0000-0000-0000000000a1', 'Org A', false, 'ORGA')
  on conflict do nothing;

insert into public.cards (id, organization_id, card_type, status, expires_at)
  values ('00000000-0000-0000-0000-0000000000c1',
          '00000000-0000-0000-0000-0000000000a1', 'digital', 'activated',
          now() + interval '30 days');

insert into public.wallet_passes (card_id, serial_number, organization_id)
  values ('00000000-0000-0000-0000-0000000000c1', 'D-000001',
          '00000000-0000-0000-0000-0000000000a1');

-- 1. expiry change enqueues card/expiry
update public.cards set expires_at = now() + interval '60 days'
  where id = '00000000-0000-0000-0000-0000000000c1';
select is(
  (select count(*)::int from public.wallet_sync_queue
   where scope='card' and reason='expiry'
   and card_id='00000000-0000-0000-0000-0000000000c1' and status='pending'),
  1, 'expiry change enqueues one card/expiry job');

-- 2. coalescing: a second expiry change does NOT create a duplicate pending row
update public.cards set expires_at = now() + interval '90 days'
  where id = '00000000-0000-0000-0000-0000000000c1';
select is(
  (select count(*)::int from public.wallet_sync_queue
   where scope='card' and reason='expiry'
   and card_id='00000000-0000-0000-0000-0000000000c1' and status='pending'),
  1, 'duplicate expiry change is coalesced to one pending job');

-- 3. status -> cancelled enqueues card/status
update public.cards set status='cancelled'
  where id='00000000-0000-0000-0000-0000000000c1';
select is(
  (select count(*)::int from public.wallet_sync_queue
   where scope='card' and reason='status'
   and card_id='00000000-0000-0000-0000-0000000000c1' and status='pending'),
  1, 'status change enqueues one card/status job');

-- 4. discount insert fans out to partnered orgs
insert into public.accounts (id, name, is_personal_account)
  values ('00000000-0000-0000-0000-0000000000m1', 'Merchant M', false)
  on conflict do nothing;
insert into public.organization_merchant_partnerships (organization_id, merchant_id)
  values ('00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-0000000000m1')
  on conflict do nothing;
insert into public.discounts (id, merchant_id, organization_id, title, discount_type, discount_value, valid_from, is_active)
  values ('00000000-0000-0000-0000-0000000000d1',
          '00000000-0000-0000-0000-0000000000m1',
          '00000000-0000-0000-0000-0000000000a1',
          'Test', 'percentage', 10, now(), true);
select is(
  (select count(*)::int from public.wallet_sync_queue
   where scope='organization' and reason='discounts'
   and organization_id='00000000-0000-0000-0000-0000000000a1' and status='pending'),
  1, 'discount insert enqueues one organization/discounts job per partnered org');

-- 5. partnership insert enqueues organization/discounts
insert into public.organization_merchant_partnerships (organization_id, merchant_id)
  values ('00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-0000000000a1')
  on conflict do nothing;
select isnt_empty(
  $$ select 1 from public.wallet_sync_queue
     where scope='organization' and reason='discounts'
     and organization_id='00000000-0000-0000-0000-0000000000a1' $$,
  'partnership change enqueues organization/discounts');

select * from finish();
rollback;
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter web supabase:test`
Expected: FAIL (no triggers yet).

- [ ] **Step 3: Append trigger functions + triggers to the schema file**

Append to `apps/web/supabase/schemas/19-wallet-pass-sync.sql`:

```sql
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
```

> **Worker note:** the trigger fan-out enqueues an org-scope job even for orgs with no saved passes yet; the worker filters to cards that actually have a `wallet_passes` row, so empty fan-outs are cheap no-ops.

> **Verify column names first:** confirm `organization_profiles.organization_name` and `batches.name`/`batches.organization_id` exist (`grep -n "organization_name" apps/web/supabase/schemas/18-tailgate-roles.sql`; check the batches schema). If a name differs, adjust the trigger body to match.

- [ ] **Step 4: Reset + test**

Run: `pnpm supabase:web:reset && pnpm --filter web supabase:test`
Expected: trigger assertions PASS.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm format:fix
git add apps/web/supabase/schemas/19-wallet-pass-sync.sql apps/web/supabase/tests/database/wallet-sync-triggers.test.sql
git commit -m "feat(wallet): enqueue triggers for card/discount/org changes"
```

---

### Task 3: Claim RPC + backfill function

**Files:**
- Modify: `apps/web/supabase/schemas/19-wallet-pass-sync.sql` (append)
- Test: `apps/web/supabase/tests/database/wallet-sync-claim.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `apps/web/supabase/tests/database/wallet-sync-claim.test.sql`:

```sql
begin;
create extension "basejump-supabase_test_helpers" version '0.0.6';
select plan(3);
set local role service_role;

insert into public.accounts (id, name, is_personal_account)
  values ('00000000-0000-0000-0000-0000000000a2', 'Org B', false)
  on conflict do nothing;
insert into public.wallet_sync_queue (scope, organization_id, reason)
  values ('organization', '00000000-0000-0000-0000-0000000000a2', 'discounts');

-- claim returns the pending job and flips it to processing
select is(
  (select count(*)::int from public.claim_wallet_sync_jobs(10)),
  1, 'claim returns one pending job');
select is(
  (select status from public.wallet_sync_queue
   where organization_id='00000000-0000-0000-0000-0000000000a2'),
  'processing', 'claimed job is now processing');

-- a second claim returns nothing (already claimed)
select is(
  (select count(*)::int from public.claim_wallet_sync_jobs(10)),
  0, 'already-claimed job is not returned again');

select * from finish();
rollback;
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter web supabase:test`
Expected: FAIL (function missing).

- [ ] **Step 3: Append the claim RPC + backfill function**

Append to `apps/web/supabase/schemas/19-wallet-pass-sync.sql`:

```sql
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
```

> **Verify** `cards.cardholder_id`, `accounts.card_prefix`, `batches.prefix`, `cards.card_number`, `cards.digital_card_number` column names against the schema before relying on the backfill expression.

- [ ] **Step 4: Reset + test**

Run: `pnpm supabase:web:reset && pnpm --filter web supabase:test`
Expected: claim assertions PASS.

- [ ] **Step 5: Generate the migration + typegen**

```bash
cd apps/web
pnpm --filter web supabase:db:diff -f wallet-pass-sync
cd ../..
pnpm supabase:web:reset
pnpm supabase:web:typegen
```

Confirm a new file exists under `apps/web/supabase/migrations/` and that `Database` types now include `wallet_passes`, `wallet_pass_registrations`, `wallet_sync_queue`, and the `claim_wallet_sync_jobs` / `backfill_wallet_passes` functions.

- [ ] **Step 6: Commit**

```bash
pnpm lint:fix && pnpm format:fix
git add apps/web/supabase/schemas/19-wallet-pass-sync.sql apps/web/supabase/tests/database/wallet-sync-claim.test.sql apps/web/supabase/migrations apps/web/lib/database.types.ts
git commit -m "feat(wallet): claim RPC + backfill function + migration + types"
```

---

## Phase 2 — Shared utilities & issuance changes

### Task 4: HMAC pass auth token

**Files:**
- Create: `apps/web/app/activate/_lib/server/pass-auth-token.ts`

- [ ] **Step 1: Write the module**

```typescript
import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Stateless authentication token embedded in Apple passes and validated by the
 * PassKit web-service endpoints. Derived as HMAC-SHA256(secret, serialNumber)
 * so no per-pass secret needs to be stored. Throws if the secret is unset.
 */
export function generatePassAuthToken(serialNumber: string): string {
  const secret = process.env.WALLET_PASS_AUTH_SECRET;
  if (!secret) {
    throw new Error('WALLET_NOT_CONFIGURED');
  }
  return createHmac('sha256', secret).update(serialNumber).digest('hex');
}

/**
 * Constant-time validation of an Apple `Authorization: ApplePass {token}` value
 * against the expected HMAC for the serial. Returns false on any mismatch or
 * length difference rather than throwing.
 */
export function verifyPassAuthToken(
  serialNumber: string,
  presentedToken: string,
): boolean {
  let expected: string;
  try {
    expected = generatePassAuthToken(serialNumber);
  } catch {
    return false;
  }
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(presentedToken, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Extracts the token from an `Authorization: ApplePass {token}` header value.
 */
export function parseApplePassAuthorization(
  header: string | null,
): string | null {
  if (!header) return null;
  const match = header.match(/^ApplePass\s+(.+)$/i);
  return match ? match[1]!.trim() : null;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Sanity-check the round trip**

Token verification is covered end-to-end by the Playwright registration test in Task 9. For an immediate local check, temporarily run a node REPL is unnecessary — the e2e test is the gate. Proceed.

- [ ] **Step 4: Commit**

```bash
pnpm lint:fix && pnpm format:fix
git add apps/web/app/activate/_lib/server/pass-auth-token.ts
git commit -m "feat(wallet): stateless HMAC pass auth token util"
```

---

### Task 5: Extend `resolveCard` with ids

**Files:**
- Modify: `apps/web/app/activate/_lib/server/resolve-card.ts`

- [ ] **Step 1: Add fields to `ResolvedCard`**

In the `ResolvedCard` interface add:

```typescript
export interface ResolvedCard {
  cardId: string;
  organizationId: string;
  cardCode: string;
  cardType: 'physical' | 'digital';
  organizationName: string;
  batchName: string | null;
  expiresAt: string | null;
  discountCount: number;
  discounts: ResolvedDiscount[];
}
```

- [ ] **Step 2: Populate them in both branches**

Physical branch — change the card select to include `id` and the return to include ids:

```typescript
    const { data: card } = await admin
      .from('cards')
      .select('id, expires_at')
      .eq('batch_id', batch.id)
      .eq('card_number', physical.cardNumber)
      .single();
    if (!card) return null;

    const discounts = toResolvedDiscounts(
      await fetchDiscountsForOrg(admin, org.id),
    );

    return {
      cardId: card.id,
      organizationId: org.id,
      cardCode: upper,
      cardType: 'physical',
      organizationName: org.name ?? 'Tailgate',
      batchName: batch.name,
      expiresAt: card.expires_at,
      discountCount: discounts.length,
      discounts,
    };
```

Digital branch — add `id` to the select and ids to the return:

```typescript
    const { data: card } = await admin
      .from('cards')
      .select('id, expires_at, organization_id')
      .eq('card_type', 'digital')
      .eq('digital_card_number', digitalNumber)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    if (!card) return null;

    const { data: org } = await admin
      .from('accounts')
      .select('id, name')
      .eq('id', card.organization_id)
      .single();

    const discounts = toResolvedDiscounts(
      await fetchDiscountsForOrg(admin, card.organization_id),
    );

    return {
      cardId: card.id,
      organizationId: card.organization_id,
      cardCode: upper,
      cardType: 'digital',
      organizationName: org?.name ?? 'Tailgate',
      batchName: null,
      expiresAt: card.expires_at,
      discountCount: discounts.length,
      discounts,
    };
```

(The physical branch already selects `org` with `id, name`; keep it.)

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (existing callers in `apple-wallet.service.ts` / `google-wallet.service.ts` ignore the new fields).

- [ ] **Step 4: Commit**

```bash
pnpm lint:fix && pnpm format:fix
git add apps/web/app/activate/_lib/server/resolve-card.ts
git commit -m "feat(wallet): expose cardId/organizationId from resolveCard"
```

---

### Task 6: `wallet-pass.repository.ts`

**Files:**
- Create: `apps/web/app/activate/_lib/server/wallet-pass.repository.ts`

- [ ] **Step 1: Write the repository**

```typescript
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '~/lib/database.types';

type Client = SupabaseClient<Database>;

interface UpsertWalletPassInput {
  cardId: string;
  serialNumber: string;
  organizationId: string;
  channel: 'google' | 'apple';
}

/**
 * Records that a card has been offered to a wallet. Upserts the wallet_passes
 * row and stamps the per-channel "offered" marker without disturbing the other
 * channel or the content_tag. Uses the admin client (service-role only table).
 */
export async function upsertWalletPass(
  admin: Client,
  input: UpsertWalletPassInput,
): Promise<void> {
  const stamp = new Date().toISOString();
  const channelColumn =
    input.channel === 'google'
      ? { google_save_requested_at: stamp }
      : { apple_pass_issued_at: stamp };

  await admin.from('wallet_passes').upsert(
    {
      card_id: input.cardId,
      serial_number: input.serialNumber,
      organization_id: input.organizationId,
      ...channelColumn,
    },
    { onConflict: 'card_id' },
  );
}

/**
 * Resolves the set of card ids affected by a batch of claimed sync jobs:
 * direct card-scope ids plus org-scope expansion to cards that actually have a
 * wallet_passes row. Returns a de-duplicated array.
 */
export async function resolveAffectedCardIds(
  admin: Client,
  jobs: Array<{
    scope: string;
    card_id: string | null;
    organization_id: string | null;
  }>,
): Promise<string[]> {
  const ids = new Set<string>();
  const orgIds = new Set<string>();

  for (const job of jobs) {
    if (job.scope === 'card' && job.card_id) ids.add(job.card_id);
    if (job.scope === 'organization' && job.organization_id) {
      orgIds.add(job.organization_id);
    }
  }

  if (orgIds.size > 0) {
    const { data } = await admin
      .from('wallet_passes')
      .select('card_id')
      .in('organization_id', [...orgIds]);
    for (const row of data ?? []) ids.add(row.card_id);
  }

  return [...ids];
}

export interface WalletPassRow {
  card_id: string;
  serial_number: string;
  organization_id: string;
  google_save_requested_at: string | null;
}

/** Loads wallet_passes rows for the given card ids. */
export async function loadWalletPasses(
  admin: Client,
  cardIds: string[],
): Promise<WalletPassRow[]> {
  if (cardIds.length === 0) return [];
  const { data } = await admin
    .from('wallet_passes')
    .select('card_id, serial_number, organization_id, google_save_requested_at')
    .in('card_id', cardIds);
  return data ?? [];
}

/** Bumps content_tag for the given card ids (Apple "last updated" marker). */
export async function bumpContentTags(
  admin: Client,
  cardIds: string[],
): Promise<void> {
  if (cardIds.length === 0) return;
  await admin
    .from('wallet_passes')
    .update({ content_tag: new Date().toISOString() })
    .in('card_id', cardIds);
}

/** Push tokens registered for an Apple pass serial. */
export async function loadRegistrationsForSerial(
  admin: Client,
  serialNumber: string,
): Promise<string[]> {
  const { data } = await admin
    .from('wallet_pass_registrations')
    .select('push_token')
    .eq('serial_number', serialNumber);
  return (data ?? []).map((r) => r.push_token);
}

/** Removes a dead registration (APNs returned 410 Gone). */
export async function deleteRegistrationByToken(
  admin: Client,
  pushToken: string,
): Promise<void> {
  await admin
    .from('wallet_pass_registrations')
    .delete()
    .eq('push_token', pushToken);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
pnpm lint:fix && pnpm format:fix
git add apps/web/app/activate/_lib/server/wallet-pass.repository.ts
git commit -m "feat(wallet): wallet_passes repository (upsert, expand, tags, registrations)"
```

---

### Task 7: Embed `webServiceURL` + token in Apple passes

**Files:**
- Modify: `apps/web/app/activate/_lib/server/apple-wallet.service.ts`

- [ ] **Step 1: Import the token util**

At the top with the other imports:

```typescript
import { generatePassAuthToken } from './pass-auth-token';
```

- [ ] **Step 2: Add web-service fields to the pass props**

In `buildPassForCard`, extend the third `PKPass` argument (the props object that currently ends at `labelColor`). Add `webServiceURL` + `authenticationToken` only when both the site URL and the HMAC secret are configured (otherwise issue a non-updatable pass rather than failing):

```typescript
    const siteUrlForService = process.env.NEXT_PUBLIC_SITE_URL;
    const canUpdate = Boolean(
      siteUrlForService && process.env.WALLET_PASS_AUTH_SECRET,
    );

    const pass = new PKPass(
      appleWalletAssetBuffers,
      {
        wwdr: config.wwdr,
        signerCert: config.signerCert,
        signerKey: config.signerKey,
        signerKeyPassphrase: config.signerKeyPassphrase,
      },
      {
        formatVersion: 1,
        passTypeIdentifier: config.passTypeIdentifier,
        teamIdentifier: config.teamIdentifier,
        organizationName: config.organizationName,
        serialNumber: cardCode,
        description: PASS_DESCRIPTION,
        backgroundColor: BACKGROUND_HEX,
        foregroundColor: FOREGROUND_HEX,
        labelColor: LABEL_HEX,
        ...(canUpdate
          ? {
              webServiceURL: new URL(
                '/api/wallet/apple',
                siteUrlForService,
              ).toString(),
              authenticationToken: generatePassAuthToken(cardCode),
            }
          : {}),
      },
    );
```

> **Note:** `webServiceURL` must be HTTPS and publicly reachable for devices to register. Against `localhost` the field is harmless but registration won't happen; test device registration against a tunnel/staging host.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
pnpm lint:fix && pnpm format:fix
git add apps/web/app/activate/_lib/server/apple-wallet.service.ts
git commit -m "feat(wallet): embed webServiceURL + auth token in new Apple passes"
```

---

### Task 8: Record pass issuance on save

**Files:**
- Modify: `apps/web/app/activate/_lib/server/wallet.actions.ts`
- Modify: `apps/web/app/api/wallet/apple/[code]/route.ts`

- [ ] **Step 1: Upsert on Google save**

In `wallet.actions.ts`, after a successful `buildSaveUrlForCard`, record the Google offer. Add the imports:

```typescript
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { upsertWalletPass } from './wallet-pass.repository';
```

Then update the success path inside `getGoogleWalletSaveUrl`:

```typescript
      try {
        const url = await buildSaveUrlForCard(resolved);
        await upsertWalletPass(getSupabaseServerAdminClient(), {
          cardId: resolved.cardId,
          serialNumber: resolved.cardCode,
          organizationId: resolved.organizationId,
          channel: 'google',
        });
        return { success: true as const, url };
      } catch (err) {
        return failFromWalletError(ctx, err, cardCode);
      }
```

> The upsert is best-effort within the existing try/catch — if it throws, the user still gets a save URL but the pass won't sync until re-saved; this is logged via the action context.

- [ ] **Step 2: Upsert on Apple pkpass download**

In `apple/[code]/route.ts`, after a successful `buildPassForCard` and when `resolveCard` returned a non-null result, upsert the Apple offer. Read the current file first to match its structure, then add:

```typescript
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { upsertWalletPass } from '~/app/activate/_lib/server/wallet-pass.repository';
```

After the pass buffer is generated and `resolved` is truthy:

```typescript
    if (resolved) {
      await upsertWalletPass(getSupabaseServerAdminClient(), {
        cardId: resolved.cardId,
        serialNumber: resolved.cardCode,
        organizationId: resolved.organizationId,
        channel: 'apple',
      });
    }
```

> If the existing route variable isn't named `resolved`, adapt to its name. The upsert must not block returning the pass — wrap in try/catch that logs and continues if you prefer extra safety.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
pnpm lint:fix && pnpm format:fix
git add apps/web/app/activate/_lib/server/wallet.actions.ts apps/web/app/api/wallet/apple/[code]/route.ts
git commit -m "feat(wallet): record wallet_passes row on Google/Apple issuance"
```

---

## Phase 3 — Apple PassKit Web Service

> All endpoints live under `apps/web/app/api/wallet/apple/v1/...` and use `enhanceRouteHandler(..., { auth: false })` + the admin client. Auth (where required) is the `Authorization: ApplePass {token}` HMAC check.

### Task 9: Register / unregister device

**Files:**
- Create: `apps/web/app/api/wallet/apple/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber]/route.ts`
- Test: `apps/e2e/tests/wallet/apple-passkit.spec.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  parseApplePassAuthorization,
  verifyPassAuthToken,
} from '~/app/activate/_lib/server/pass-auth-token';

interface Params {
  params: Promise<{
    deviceLibraryIdentifier: string;
    passTypeIdentifier: string;
    serialNumber: string;
  }>;
}

// POST: register a device to receive updates for a pass serial.
export const POST = enhanceRouteHandler(
  async ({ request }, { params }: Params) => {
    const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } =
      await params;
    const logger = await getLogger();
    const ctx = { name: 'wallet.apple.register', serialNumber };

    const token = parseApplePassAuthorization(
      request.headers.get('authorization'),
    );
    if (!token || !verifyPassAuthToken(serialNumber, token)) {
      logger.warn(ctx, 'Apple registration rejected: bad auth token');
      return new Response('Unauthorized', { status: 401 });
    }

    let pushToken: string;
    try {
      const body = (await request.json()) as { pushToken?: string };
      if (!body.pushToken) return new Response('Bad Request', { status: 400 });
      pushToken = body.pushToken;
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    const admin = getSupabaseServerAdminClient();

    // Pass serial must exist (issued via our flow) to register against.
    const { data: pass } = await admin
      .from('wallet_passes')
      .select('serial_number')
      .eq('serial_number', serialNumber)
      .maybeSingle();
    if (!pass) return new Response('Not Found', { status: 404 });

    const { error, data: existing } = await admin
      .from('wallet_pass_registrations')
      .select('device_library_identifier')
      .eq('device_library_identifier', deviceLibraryIdentifier)
      .eq('serial_number', serialNumber)
      .maybeSingle();

    if (error) {
      logger.error({ ...ctx, error: error.message }, 'register lookup failed');
      return new Response('Server Error', { status: 500 });
    }

    await admin.from('wallet_pass_registrations').upsert(
      {
        device_library_identifier: deviceLibraryIdentifier,
        serial_number: serialNumber,
        pass_type_identifier: passTypeIdentifier,
        push_token: pushToken,
      },
      { onConflict: 'device_library_identifier,serial_number' },
    );

    // 201 on first registration, 200 if already registered (PassKit spec).
    return new NextResponse(null, { status: existing ? 200 : 201 });
  },
  { auth: false },
);

// DELETE: unregister a device from a pass serial.
export const DELETE = enhanceRouteHandler(
  async ({ request }, { params }: Params) => {
    const { deviceLibraryIdentifier, serialNumber } = await params;

    const token = parseApplePassAuthorization(
      request.headers.get('authorization'),
    );
    if (!token || !verifyPassAuthToken(serialNumber, token)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const admin = getSupabaseServerAdminClient();
    await admin
      .from('wallet_pass_registrations')
      .delete()
      .eq('device_library_identifier', deviceLibraryIdentifier)
      .eq('serial_number', serialNumber);

    return new Response(null, { status: 200 });
  },
  { auth: false },
);
```

- [ ] **Step 2: Write the failing Playwright test (covers register round-trip)**

Create `apps/e2e/tests/wallet/apple-passkit.spec.ts`. It seeds a `wallet_passes` row via the admin client, then drives the PassKit endpoints with the correct HMAC token. (Follow existing e2e setup conventions in `apps/e2e` for the Supabase admin client + base URL; the snippet below shows the assertions.)

```typescript
import { createHmac } from 'node:crypto';

import { expect, test } from '@playwright/test';

const SERIAL = 'D-009001';
const DEVICE = 'e2e-device-001';
const PASS_TYPE = process.env.APPLE_WALLET_PASS_TYPE_ID ?? 'pass.com.tailgate.card';

function token(serial: string) {
  return createHmac('sha256', process.env.WALLET_PASS_AUTH_SECRET!)
    .update(serial)
    .digest('hex');
}

test.describe('Apple PassKit web service', () => {
  // NOTE: a beforeAll hook must insert a wallet_passes row for SERIAL using the
  // service-role client (see apps/e2e existing helpers for client construction).

  test('rejects registration with a bad auth token', async ({ request }) => {
    const res = await request.post(
      `/api/wallet/apple/v1/devices/${DEVICE}/registrations/${PASS_TYPE}/${SERIAL}`,
      {
        headers: { Authorization: 'ApplePass deadbeef' },
        data: { pushToken: 'tok-1' },
      },
    );
    expect(res.status()).toBe(401);
  });

  test('registers a device then lists it via passesUpdatedSince', async ({
    request,
  }) => {
    const reg = await request.post(
      `/api/wallet/apple/v1/devices/${DEVICE}/registrations/${PASS_TYPE}/${SERIAL}`,
      {
        headers: { Authorization: `ApplePass ${token(SERIAL)}` },
        data: { pushToken: 'tok-1' },
      },
    );
    expect([200, 201]).toContain(reg.status());

    const list = await request.get(
      `/api/wallet/apple/v1/devices/${DEVICE}/registrations/${PASS_TYPE}`,
    );
    expect(list.status()).toBe(200);
    const body = await list.json();
    expect(body.serialNumbers).toContain(SERIAL);
  });
});
```

- [ ] **Step 3: Run the bad-token test — expect the registration test to fail (endpoint for list not built yet)**

Run: `pnpm --filter e2e test wallet/apple-passkit`
Expected: bad-token test PASSES; the list test FAILS (passesUpdatedSince route is Task 10).

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm format:fix
git add "apps/web/app/api/wallet/apple/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber]/route.ts" apps/e2e/tests/wallet/apple-passkit.spec.ts
git commit -m "feat(wallet): Apple PassKit device register/unregister endpoints"
```

---

### Task 10: `passesUpdatedSince` endpoint

**Files:**
- Create: `apps/web/app/api/wallet/apple/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

interface Params {
  params: Promise<{
    deviceLibraryIdentifier: string;
    passTypeIdentifier: string;
  }>;
}

// GET: serials registered to this device whose content changed since `passesUpdatedSince`.
export const GET = enhanceRouteHandler(
  async ({ request }, { params }: Params) => {
    const { deviceLibraryIdentifier } = await params;
    const since = new URL(request.url).searchParams.get('passesUpdatedSince');

    const admin = getSupabaseServerAdminClient();

    const { data: regs } = await admin
      .from('wallet_pass_registrations')
      .select('serial_number')
      .eq('device_library_identifier', deviceLibraryIdentifier);

    const serials = (regs ?? []).map((r) => r.serial_number);
    if (serials.length === 0) {
      return new Response(null, { status: 204 });
    }

    let query = admin
      .from('wallet_passes')
      .select('serial_number, content_tag')
      .in('serial_number', serials);

    if (since) {
      // `since` is the tag we previously returned (ISO timestamp).
      query = query.gt('content_tag', since);
    }

    const { data: passes } = await query;
    const changed = passes ?? [];

    if (changed.length === 0) {
      return new Response(null, { status: 204 });
    }

    const lastUpdated = changed
      .map((p) => p.content_tag)
      .sort()
      .at(-1)!;

    return NextResponse.json({
      lastUpdated,
      serialNumbers: changed.map((p) => p.serial_number),
    });
  },
  { auth: false },
);
```

- [ ] **Step 2: Run the Task 9 Playwright test — list test now passes**

Run: `pnpm --filter e2e test wallet/apple-passkit`
Expected: both tests PASS.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm format:fix
git add "apps/web/app/api/wallet/apple/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/route.ts"
git commit -m "feat(wallet): Apple passesUpdatedSince endpoint"
```

---

### Task 11: Pass re-fetch endpoint (with 304)

**Files:**
- Create: `apps/web/app/api/wallet/apple/v1/passes/[passTypeIdentifier]/[serialNumber]/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { buildPassForCard } from '~/app/activate/_lib/server/apple-wallet.service';
import {
  parseApplePassAuthorization,
  verifyPassAuthToken,
} from '~/app/activate/_lib/server/pass-auth-token';
import { resolveCard } from '~/app/activate/_lib/server/resolve-card';

interface Params {
  params: Promise<{ passTypeIdentifier: string; serialNumber: string }>;
}

// GET: return the latest signed .pkpass for a serial. Honors If-Modified-Since.
export const GET = enhanceRouteHandler(
  async ({ request }, { params }: Params) => {
    const { serialNumber } = await params;
    const logger = await getLogger();
    const ctx = { name: 'wallet.apple.getPass', serialNumber };

    const token = parseApplePassAuthorization(
      request.headers.get('authorization'),
    );
    if (!token || !verifyPassAuthToken(serialNumber, token)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const admin = getSupabaseServerAdminClient();
    const { data: pass } = await admin
      .from('wallet_passes')
      .select('content_tag')
      .eq('serial_number', serialNumber)
      .maybeSingle();
    if (!pass) return new Response('Not Found', { status: 404 });

    const lastModified = new Date(pass.content_tag);
    const ims = request.headers.get('if-modified-since');
    if (ims) {
      const since = new Date(ims);
      // Second-resolution comparison (HTTP dates drop milliseconds).
      if (
        !isNaN(since.getTime()) &&
        Math.floor(lastModified.getTime() / 1000) <=
          Math.floor(since.getTime() / 1000)
      ) {
        return new Response(null, { status: 304 });
      }
    }

    const resolved = await resolveCard(serialNumber);
    if (!resolved) {
      logger.warn(ctx, 'pass re-fetch could not resolve card');
      return new Response('Not Found', { status: 404 });
    }

    const buffer = await buildPassForCard({
      cardCode: resolved.cardCode,
      cardType: resolved.cardType,
      organizationName: resolved.organizationName,
      batchName: resolved.batchName,
      expiresAt: resolved.expiresAt,
      discountCount: resolved.discountCount,
      discounts: resolved.discounts,
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Last-Modified': lastModified.toUTCString(),
        'Cache-Control': 'no-store',
      },
    });
  },
  { auth: false },
);
```

- [ ] **Step 2: Extend the Playwright test with a re-fetch assertion**

Append to `apps/e2e/tests/wallet/apple-passkit.spec.ts`:

```typescript
  test('serves a pkpass for a valid token and 401 for a bad one', async ({
    request,
  }) => {
    const ok = await request.get(
      `/api/wallet/apple/v1/passes/${PASS_TYPE}/${SERIAL}`,
      { headers: { Authorization: `ApplePass ${token(SERIAL)}` } },
    );
    expect(ok.status()).toBe(200);
    expect(ok.headers()['content-type']).toContain('apple.pkpass');

    const bad = await request.get(
      `/api/wallet/apple/v1/passes/${PASS_TYPE}/${SERIAL}`,
      { headers: { Authorization: 'ApplePass nope' } },
    );
    expect(bad.status()).toBe(401);
  });
```

- [ ] **Step 3: Run — expect PASS**

Run: `pnpm --filter e2e test wallet/apple-passkit`
Expected: all assertions PASS (requires the seeded card to be resolvable by `resolveCard`; seed a real digital card in the beforeAll so `resolveCard('D-009001')` succeeds).

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm format:fix
git add "apps/web/app/api/wallet/apple/v1/passes/[passTypeIdentifier]/[serialNumber]/route.ts" apps/e2e/tests/wallet/apple-passkit.spec.ts
git commit -m "feat(wallet): Apple pass re-fetch endpoint with If-Modified-Since"
```

---

### Task 12: Log endpoint

**Files:**
- Create: `apps/web/app/api/wallet/apple/v1/log/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';

// POST: Apple devices report errors here. Always 200.
export const POST = enhanceRouteHandler(
  async ({ request }) => {
    const logger = await getLogger();
    try {
      const body = (await request.json()) as { logs?: string[] };
      logger.info(
        { name: 'wallet.apple.log', logs: body.logs ?? [] },
        'Apple Wallet device log',
      );
    } catch {
      // ignore malformed bodies
    }
    return new Response(null, { status: 200 });
  },
  { auth: false },
);
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm format:fix
git add apps/web/app/api/wallet/apple/v1/log/route.ts
git commit -m "feat(wallet): Apple PassKit log endpoint"
```

---

## Phase 4 — Sync engine

### Task 13: Google Wallet object update service

**Files:**
- Modify: `apps/web/app/activate/_lib/server/google-wallet.service.ts` (export reusable bits)
- Create: `apps/web/app/activate/_lib/server/google-wallet-update.service.ts`

- [ ] **Step 1: Export the reusable object builder from `google-wallet.service.ts`**

The updater must produce the same `textModulesData`/`header` shape as the save flow. Change `buildTextModules` and `buildGenericObject` (and `BuildSaveUrlInput`, `WalletConfig`, `readConfig`) from module-private to `export`. Add `export` to each declaration; no logic change. Example:

```typescript
export interface BuildSaveUrlInput { /* unchanged */ }
export function readConfig(): WalletConfig { /* unchanged */ }
export function buildTextModules(input: BuildSaveUrlInput) { /* unchanged */ }
export function buildGenericObject(config: WalletConfig, input: BuildSaveUrlInput) { /* unchanged */ }
```

- [ ] **Step 2: Write the updater**

```typescript
import 'server-only';

import { SignJWT, importPKCS8 } from 'jose';

import { getLogger } from '@kit/shared/logger';

import {
  type BuildSaveUrlInput,
  buildGenericObject,
  readConfig,
} from './google-wallet.service';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const WALLET_OBJECT_BASE =
  'https://walletobjects.googleapis.com/walletobjects/v1/genericObject';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

async function getAccessToken(
  saEmail: string,
  privateKeyPem: string,
): Promise<string> {
  const key = await importPKCS8(privateKeyPem, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(saEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`GOOGLE_TOKEN_FAILED:${res.status}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export type GoogleUpdateResult = 'updated' | 'not_saved' | 'failed';

/**
 * Patches an already-saved Google Wallet object with refreshed content. Returns
 * 'not_saved' on 404 (object never created), 'failed' on other errors, so the
 * worker can decide whether to retry. Reuses buildGenericObject so the patched
 * fields exactly match the save-flow layout.
 */
export async function updateGoogleWalletObject(
  input: BuildSaveUrlInput,
): Promise<GoogleUpdateResult> {
  const logger = await getLogger();
  let config;
  try {
    config = readConfig();
  } catch {
    return 'failed';
  }

  try {
    const token = await getAccessToken(config.saEmail, config.privateKeyPem);
    const object = buildGenericObject(config, input);
    const resourceId = object.id; // `${issuerId}.${cardCode}`

    const res = await fetch(`${WALLET_OBJECT_BASE}/${resourceId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      // Patch the mutable content fields; leave id/classId/barcode untouched.
      body: JSON.stringify({
        header: object.header,
        textModulesData: object.textModulesData,
      }),
    });

    if (res.status === 404) return 'not_saved';
    if (!res.ok) {
      logger.error(
        { name: 'wallet.google.update', resourceId, status: res.status },
        'Google Wallet object PATCH failed',
      );
      return 'failed';
    }
    return 'updated';
  } catch (err) {
    logger.error(
      { name: 'wallet.google.update', cardCode: input.cardCode, err },
      'Google Wallet update threw',
    );
    return 'failed';
  }
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm format:fix
git add apps/web/app/activate/_lib/server/google-wallet.service.ts apps/web/app/activate/_lib/server/google-wallet-update.service.ts
git commit -m "feat(wallet): Google Wallet object update service (OAuth + PATCH)"
```

---

### Task 14: APNs push service

**Files:**
- Create: `apps/web/app/activate/_lib/server/apns.service.ts`

- [ ] **Step 1: Write the service**

```typescript
import 'server-only';

import http2 from 'node:http2';

import { SignJWT, importPKCS8 } from 'jose';

import { getLogger } from '@kit/shared/logger';

const APNS_HOST = 'https://api.push.apple.com';

interface ApnsConfig {
  authKey: string;
  keyId: string;
  teamId: string;
  topic: string;
}

function readApnsConfig(): ApnsConfig | null {
  const authKey = process.env.APNS_AUTH_KEY;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APPLE_WALLET_TEAM_ID;
  const topic = process.env.APPLE_WALLET_PASS_TYPE_ID;
  if (!authKey || !keyId || !teamId || !topic) return null;
  return { authKey: authKey.replace(/\\n/g, '\n'), keyId, teamId, topic };
}

// APNs provider tokens are valid up to 60 min; refresh well within that.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getProviderToken(config: ApnsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.value;
  }
  const key = await importPKCS8(config.authKey, 'ES256');
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(now)
    .sign(key);
  cachedToken = { value, expiresAt: now + 3000 };
  return value;
}

export type ApnsResult =
  | { status: 'sent' }
  | { status: 'gone' } // 410 — token invalid, prune the registration
  | { status: 'failed'; code: number };

/**
 * Sends an empty PassKit update push to one device token. Wallet update pushes
 * carry an empty `{}` payload; the device responds by re-fetching the pass.
 * Returns 'gone' on HTTP 410 so the caller can delete the dead registration.
 */
export async function sendPassUpdatePush(
  pushToken: string,
): Promise<ApnsResult> {
  const logger = await getLogger();
  const config = readApnsConfig();
  if (!config) return { status: 'failed', code: 0 };

  const jwt = await getProviderToken(config);

  return new Promise<ApnsResult>((resolve) => {
    const client = http2.connect(APNS_HOST);
    client.on('error', (err) => {
      logger.error({ name: 'wallet.apns', err }, 'APNs connection error');
      resolve({ status: 'failed', code: 0 });
      client.close();
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': config.topic,
      'apns-push-type': 'background',
      'apns-priority': '5',
      'content-type': 'application/json',
    });

    let status = 0;
    req.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0);
    });
    req.setEncoding('utf8');
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      client.close();
      if (status === 200) return resolve({ status: 'sent' });
      if (status === 410) return resolve({ status: 'gone' });
      logger.warn(
        { name: 'wallet.apns', status, data },
        'APNs push non-200',
      );
      resolve({ status: 'failed', code: status });
    });
    req.on('error', (err) => {
      logger.error({ name: 'wallet.apns', err }, 'APNs request error');
      client.close();
      resolve({ status: 'failed', code: 0 });
    });

    req.write('{}');
    req.end();
  });
}
```

> **APNs payload note:** Wallet update pushes use an empty `{}` body. `apns-push-type: background` + `apns-priority: 5` is the correct classification for a content-availability push with no alert. If Apple rejects with `PayloadEmpty`/`TopicDisallowed` in testing, the topic must equal the Pass Type ID exactly — it does (reused from `APPLE_WALLET_PASS_TYPE_ID`).

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm format:fix
git add apps/web/app/activate/_lib/server/apns.service.ts
git commit -m "feat(wallet): token-based APNs push service (http2 + ES256 JWT)"
```

---

### Task 15: Sync worker route

**Files:**
- Create: `apps/web/app/api/wallet/sync/route.ts`
- Test: `apps/e2e/tests/wallet/sync-worker.spec.ts`

- [ ] **Step 1: Write the failing Playwright test**

Create `apps/e2e/tests/wallet/sync-worker.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

test.describe('wallet sync worker', () => {
  test('rejects without the cron secret', async ({ request }) => {
    const res = await request.get('/api/wallet/sync');
    expect(res.status()).toBe(401);
  });

  test('drains a pending job and bumps content_tag', async ({ request }) => {
    // beforeAll (see apps/e2e helpers) must: insert a wallet_passes row for a
    // resolvable card and a pending wallet_sync_queue row for it, then capture
    // its content_tag. This test asserts the worker advances state.
    const res = await request.get('/api/wallet/sync', {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.processed).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter e2e test wallet/sync-worker`
Expected: FAIL (route missing).

- [ ] **Step 3: Write the worker route**

```typescript
import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { sendPassUpdatePush } from '~/app/activate/_lib/server/apns.service';
import { updateGoogleWalletObject } from '~/app/activate/_lib/server/google-wallet-update.service';
import { resolveCard } from '~/app/activate/_lib/server/resolve-card';
import {
  bumpContentTags,
  deleteRegistrationByToken,
  loadRegistrationsForSerial,
  loadWalletPasses,
  resolveAffectedCardIds,
} from '~/app/activate/_lib/server/wallet-pass.repository';

const BATCH = 200;
const BACKOFF_SECONDS = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// GET: drain the wallet_sync_queue. Invoked by Vercel Cron (Authorization: Bearer CRON_SECRET).
export const GET = enhanceRouteHandler(
  async ({ request }) => {
    if (!authorized(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const logger = await getLogger();
    const admin = getSupabaseServerAdminClient();
    const ctx = { name: 'wallet.sync' };

    const { data: jobs, error } = await admin.rpc('claim_wallet_sync_jobs', {
      p_limit: BATCH,
    });
    if (error) {
      logger.error({ ...ctx, error: error.message }, 'claim failed');
      return new Response('Server Error', { status: 500 });
    }
    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ processed: 0, cards: 0 });
    }

    const jobIds = jobs.map((j) => j.id);

    try {
      const cardIds = await resolveAffectedCardIds(admin, jobs);
      await bumpContentTags(admin, cardIds);
      const passes = await loadWalletPasses(admin, cardIds);

      for (const pass of passes) {
        const resolved = await resolveCard(pass.serial_number);
        if (!resolved) continue;

        // Google: only if the card was ever offered to Google.
        if (pass.google_save_requested_at) {
          await updateGoogleWalletObject({
            cardCode: resolved.cardCode,
            cardType: resolved.cardType,
            organizationName: resolved.organizationName,
            batchName: resolved.batchName,
            expiresAt: resolved.expiresAt,
            discountCount: resolved.discountCount,
            discounts: resolved.discounts,
          });
        }

        // Apple: push every registered device; prune dead tokens.
        const tokens = await loadRegistrationsForSerial(
          admin,
          pass.serial_number,
        );
        for (const token of tokens) {
          const result = await sendPassUpdatePush(token);
          if (result.status === 'gone') {
            await deleteRegistrationByToken(admin, token);
          }
        }
      }

      await admin
        .from('wallet_sync_queue')
        .update({ status: 'done', processed_at: new Date().toISOString() })
        .in('id', jobIds);

      logger.info(
        { ...ctx, jobs: jobIds.length, cards: cardIds.length },
        'wallet sync drain complete',
      );
      return NextResponse.json({
        processed: jobIds.length,
        cards: cardIds.length,
      });
    } catch (err) {
      const notBefore = new Date(Date.now() + BACKOFF_SECONDS * 1000);
      await admin
        .from('wallet_sync_queue')
        .update({
          status: 'failed',
          last_error: err instanceof Error ? err.message : 'unknown',
          not_before: notBefore.toISOString(),
        })
        .in('id', jobIds);
      logger.error({ ...ctx, err }, 'wallet sync drain failed');
      return new Response('Server Error', { status: 500 });
    }
  },
  { auth: false },
);
```

> **Retry semantics:** failed jobs are flipped back via a follow-up — to retry, a small companion step should reset `failed` → `pending` once `not_before` passes. For the first cut, `failed` rows are left for inspection; add a `where status='failed' and not_before<=now()` reset to `claim_wallet_sync_jobs`'s selection if automatic retry is desired (note in Open Items).

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter e2e test wallet/sync-worker`
Expected: both tests PASS (Google/APNs calls no-op or log when unconfigured locally; the test only asserts `processed >= 1` and state advance).

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm format:fix
git add apps/web/app/api/wallet/sync/route.ts apps/e2e/tests/wallet/sync-worker.spec.ts
git commit -m "feat(wallet): sync worker route draining the queue (Google PATCH + APNs)"
```

---

### Task 16: Vercel Cron wiring

**Files:**
- Create: `vercel.json` (repo root) — or modify if present.

- [ ] **Step 1: Add the cron entry**

Create `vercel.json` at the repo root (per-minute schedule requires a Vercel plan that allows it; otherwise use the densest the plan permits and note the latency in Open Items):

```json
{
  "crons": [
    {
      "path": "/api/wallet/sync",
      "schedule": "* * * * *"
    }
  ]
}
```

> Vercel automatically attaches `Authorization: Bearer ${CRON_SECRET}` to cron invocations when `CRON_SECRET` is set in project env — which is exactly what the worker checks. Ensure `CRON_SECRET` is set in Vercel (Production + Preview).

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat(wallet): Vercel Cron entry to drive the sync worker"
```

---

## Phase 5 — Backfill, errors, docs

### Task 17: Backfill migration for existing Google passes

**Files:**
- Create: `apps/web/supabase/migrations/<timestamp>_wallet-pass-backfill.sql` (hand-authored, runs the function once)

- [ ] **Step 1: Author the migration**

Create a new migration file (use the current UTC timestamp in `YYYYMMDDHHmmss` format):

```sql
-- Migration: Wallet pass backfill
--
-- Seeds wallet_passes for already-activated cards whose holder optimistically
-- saved to Google Wallet (cardholder_profiles.google_wallet_added_at). This
-- makes org-wide discount/expiry changes reach EXISTING Google passes on the
-- first worker drain. Apple passes cannot be backfilled (existing ones lack the
-- embedded webServiceURL) and are intentionally excluded.
select public.backfill_wallet_passes();
```

- [ ] **Step 2: Apply locally and verify**

```bash
pnpm --filter web supabase migrations up
```

Expected: runs without error. (On a fresh local DB there may be zero eligible rows — that's fine; the assertion is that the function executes.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/supabase/migrations
git commit -m "feat(wallet): backfill wallet_passes for existing Google saves"
```

---

### Task 18: Wallet error codes + env docs

**Files:**
- Modify: `apps/web/app/activate/_lib/wallet-errors.ts`
- Modify: `apps/web/.env.example` (create the entries if absent)

- [ ] **Step 1: Add error codes**

```typescript
export type WalletErrorCode =
  | 'WALLET_NOT_CONFIGURED'
  | 'WALLET_GENERATION_FAILED'
  | 'CARD_NOT_FOUND'
  | 'WALLET_SYNC_FAILED'
  | 'WALLET_REGISTRATION_INVALID'
  | 'WALLET_PASS_AUTH_FAILED';

const WALLET_MESSAGES: Record<WalletErrorCode, string> = {
  WALLET_NOT_CONFIGURED:
    'Wallet is temporarily unavailable. Please try again later.',
  WALLET_GENERATION_FAILED:
    "We couldn't generate your wallet pass. Please try again.",
  CARD_NOT_FOUND: 'We could not find a card matching that code.',
  WALLET_SYNC_FAILED: 'We could not sync your wallet pass. Please try again.',
  WALLET_REGISTRATION_INVALID: 'This wallet pass registration is not valid.',
  WALLET_PASS_AUTH_FAILED: 'This wallet pass could not be authenticated.',
};
```

- [ ] **Step 2: Document env vars**

Add to `apps/web/.env.example`:

```bash
# Wallet pass sync
WALLET_PASS_AUTH_SECRET=   # openssl rand -hex 32; HMAC secret for Apple pass auth tokens
CRON_SECRET=               # openssl rand -hex 32; guards /api/wallet/sync (Vercel Cron auto-sends it)
APNS_AUTH_KEY=             # APNs .p8 contents, newlines escaped as \n
APNS_KEY_ID=               # APNs key id from developer.apple.com
# APNs team id reuses APPLE_WALLET_TEAM_ID; APNs topic reuses APPLE_WALLET_PASS_TYPE_ID
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm format:fix
git add apps/web/app/activate/_lib/wallet-errors.ts apps/web/.env.example
git commit -m "feat(wallet): sync error codes + env documentation"
```

---

### Task 19: Full verification pass

- [ ] **Step 1: Type, lint, format**

Run: `pnpm typecheck && pnpm lint && pnpm format`
Expected: all clean.

- [ ] **Step 2: Full DB test suite**

Run: `pnpm supabase:web:reset && pnpm --filter web supabase:test`
Expected: all pgTAP suites (including the three wallet-sync suites) PASS.

- [ ] **Step 3: e2e wallet suite**

Run: `pnpm --filter e2e test wallet`
Expected: PassKit + sync-worker specs PASS.

- [ ] **Step 4: Manual smoke (optional, against a tunnel)**

Save a card to Apple Wallet on a device (pass now carries `webServiceURL`); confirm a row appears in `wallet_pass_registrations`. Edit a discount; within ~1 min the device re-fetches and the pass updates. Save to Google; edit a discount; confirm the Google pass reflects it.

---

## Self-Review Notes (addressed)

- **Spec coverage:** every spec section maps to a task — tables (T1), triggers (T2), claim/backfill (T3), HMAC (T4), resolveCard ids (T5), repository (T6), issuance webServiceURL/token (T7), issuance recording (T8), PassKit endpoints register/unregister/passesUpdatedSince/pass/log (T9–T12), Google update (T13), APNs (T14), worker (T15), Vercel Cron (T16), backfill (T17), errors+env (T18), verification (T19).
- **Refinement deviations** from spec are listed in the header (`google_object_id` dropped; worker is GET+Bearer). Spec table updated to match.
- **Type consistency:** `ResolvedCard` gains `cardId`/`organizationId` (T5) used by T8/T11/T15; repository function names (`upsertWalletPass`, `resolveAffectedCardIds`, `loadWalletPasses`, `bumpContentTags`, `loadRegistrationsForSerial`, `deleteRegistrationByToken`) are referenced consistently in T8/T15; `generatePassAuthToken`/`verifyPassAuthToken`/`parseApplePassAuthorization` consistent across T7/T9/T11; `updateGoogleWalletObject`/`sendPassUpdatePush` signatures match their worker call sites.

## Open Items / Follow-ups

- **Automatic retry of `failed` jobs:** first cut leaves `failed` rows for inspection. To auto-retry, extend `claim_wallet_sync_jobs` selection to include `status='failed' and not_before<=now()` and reset them to `processing`.
- **APNs throughput:** org-wide fan-out pushes are sent sequentially per drain; if volumes grow, batch with a shared http2 session or bounded concurrency.
- **Per-minute cron** requires a Vercel plan that allows it; otherwise latency rises to the densest allowed cadence.
- **Verify column names** flagged inline in T2/T3 (`organization_profiles.organization_name`, `batches.name`, `accounts.card_prefix`, `batches.prefix`, `cards.cardholder_id`) before relying on the trigger/backfill SQL.
