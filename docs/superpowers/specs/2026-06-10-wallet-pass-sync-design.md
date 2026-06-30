# Wallet Pass Sync — Design Spec

**Date:** 2026-06-10
**Status:** Approved (brainstorming), pending implementation plan
**Related:** M7 Wallet Integration epic; `apps/web/app/activate/_lib/server/{apple-wallet,google-wallet}.service.ts`, `resolve-card.ts`, `wallet.actions.ts`

> Note: per the user's "docs → Obsidian" preference this spec should be mirrored to the Obsidian vault; it was written to the repo because the Obsidian local server was unreachable at authoring time. It also lives in git so `executing-plans` can read it.

## Problem

Wallet passes (Apple `.pkpass`, Google Wallet object) are generated as **static snapshots** at save time. When a card's data changes after it's already in a holder's wallet — expiry date edited, the org's discount list changes, org/batch renamed, or the card is cancelled/revoked — the saved pass goes stale. There is no mechanism to propagate those changes to already-saved passes.

## Goals

Propagate the following changes to already-saved passes, near-real-time (~1 minute):

1. **Card expiry** changes (`cards.expires_at`) — per-card.
2. **Discount list** changes — add/remove/edit/activate/deactivate a discount, or change an org↔merchant partnership. Org-scoped: fans out to every card in affected orgs.
3. **Org name / batch name** changes — cosmetic header/aux fields.
4. **Card status** changes — cancelled/expired/revoked reflected so a stale pass can't be presented.

## Non-Goals

- Retrofitting **existing Apple passes** (structurally impossible — see Asymmetry).
- Real-time sub-second propagation. ~1 minute via cron is acceptable.
- Changing the entitlement model: the pass remains cosmetic; entitlement is the DB row validated at the merchant POS.

## The Core Asymmetry

| | Google Wallet | Apple Wallet |
|---|---|---|
| **Update API** | Server calls `PATCH genericObject/{id}`; Google propagates to all devices automatically. | None. Must run the **PassKit Web Service**: device registers → server sends APNs push → device re-fetches the pass from us. |
| **Existing saved passes** | **Syncable** — the object already exists server-side under a deterministic id `{issuerId}.{cardCode}`. | **NOT syncable** — already-issued passes lack an embedded `webServiceURL` + `authenticationToken`. Only passes issued **after** this ships can update. |
| **New secrets** | none (reuse `GOOGLE_WALLET_*` SA creds) | APNs `.p8` key + `WALLET_PASS_AUTH_SECRET` |

**Consequence:** existing Apple passes are documented as un-syncable; a holder must re-save to get the new (sync-capable) pass format. Existing Google passes become syncable for free once the worker ships.

## Architecture

```
 mutation (discount/card/partnership/org_profile/batch)
        │  AFTER trigger (INSERT-only, no HTTP → pg_net not required)
        ▼
 wallet_sync_queue  ── coalesced, durable outbox
        │
        │  Vercel Cron (~1 min) → POST /api/wallet/sync  (CRON_SECRET bearer)
        ▼
   Sync worker
     ├─ expand org-scope jobs → affected card_ids that have a wallet_passes row
     ├─ bump wallet_passes.content_tag = now()
     ├─ Google: PATCH genericObject/{issuerId}.{serial}  (SA OAuth token); 404 → skip
     └─ Apple:  APNs push to each registration for the serial; 410 → prune
        │
        ▼ (Apple only, device-initiated)
   PassKit Web Service  /api/wallet/apple/v1/...
     register / unregister / passesUpdatedSince / pass re-fetch / log
```

## Data Model (3 tables)

### `wallet_passes`
One row per card ever offered to a wallet. Represents "a pass may exist in wallets for this card."

| column | type | notes |
|---|---|---|
| `card_id` | uuid PK → `cards.id` | |
| `serial_number` | text unique | display code; denormalized so Apple endpoints serve without re-deriving |
| `organization_id` | uuid | denormalized for org-scoped fan-out |
| `content_tag` | timestamptz not null default now() | Apple's "last updated" marker; bumped on every content change |
| `google_save_requested_at` | timestamptz null | set when Google save URL generated; doubles as the "offered to Google" flag |
| `apple_pass_issued_at` | timestamptz null | set when `.pkpass` downloaded |

> **Refinement:** the Google object id is **not stored** — it is deterministic (`{GOOGLE_WALLET_ISSUER_ID}.{serial_number}`) and computed at runtime. `google_save_requested_at` non-null is the signal to attempt a Google PATCH; a Google `404` means the save never completed → skipped harmlessly.
| `created_at`, `updated_at` | timestamptz | |

### `wallet_pass_registrations`
The PassKit device↔pass registration store (Apple only).

| column | type | notes |
|---|---|---|
| `device_library_identifier` | text | part of PK |
| `serial_number` | text → `wallet_passes.serial_number` | part of PK |
| `push_token` | text not null | APNs device token |
| `created_at`, `updated_at` | timestamptz | |

PK `(device_library_identifier, serial_number)`.

### `wallet_sync_queue`
Durable outbox.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `scope` | text check in (`card`,`organization`) | |
| `card_id` | uuid null → `cards.id` | for `card` scope |
| `organization_id` | uuid null → `accounts.id` | for `organization` scope |
| `reason` | text | `expiry`\|`discounts`\|`org_profile`\|`status` |
| `status` | text default `pending` check in (`pending`,`processing`,`done`,`failed`) | |
| `attempts` | int default 0 | |
| `last_error` | text null | |
| `not_before` | timestamptz default now() | backoff |
| `created_at`, `processed_at` | timestamptz | |

Partial-unique index over `(scope, card_id, organization_id, reason) WHERE status = 'pending'` to coalesce duplicate pending jobs. **Must use `UNIQUE NULLS NOT DISTINCT`** (PG15+, available on Supabase) — `card_id`/`organization_id` are nullable and default Postgres treats `NULL` as distinct, which would silently defeat coalescing.

RLS: all three tables are service-role/worker only — no cardholder-facing reads. (Apple web-service endpoints use the admin client + HMAC token auth, not RLS.)

## Change Detection → Enqueue (DB triggers)

Triggers **only INSERT into `wallet_sync_queue`** — no outbound HTTP, so the dropped `pg_net` extension is irrelevant.

- `AFTER UPDATE ON cards`: `expires_at` changed ⇒ enqueue `card/expiry`; `status` → `cancelled`/`expired` ⇒ enqueue `card/status`.
- `AFTER INSERT/UPDATE/DELETE ON discounts`: enqueue `organization/discounts` for **every org partnered with that merchant** (via `organization_merchant_partnerships WHERE merchant_id = discount.merchant_id`) — mirrors `fetchDiscountsForOrg`'s partnership scoping.
- `AFTER INSERT/DELETE ON organization_merchant_partnerships`: enqueue `organization/discounts` for that org.
- `AFTER UPDATE ON organization_profiles` (name) / `batches` (name): enqueue `organization/org_profile`.

All trigger functions are `SECURITY DEFINER`, `set search_path = ''`, consistent with repo convention.

## Worker — `GET /api/wallet/sync`

`enhanceRouteHandler`, no user auth, guarded by `Authorization: Bearer {CRON_SECRET}`. Driven by **Vercel Cron** (`vercel.json` crons entry, ~every 1 min), which natively attaches that bearer when `CRON_SECRET` is set. Scheduler-agnostic: any caller with the secret works.

Per drain:
1. Claim a batch of `pending` rows where `not_before <= now()` using `FOR UPDATE SKIP LOCKED`; set `processing`.
2. Expand `organization` jobs → affected `card_id`s **that have a `wallet_passes` row** (i.e. actually offered to a wallet). Dedupe to a card set.
3. Bump `content_tag = now()` for each affected pass.
4. **Google**: build fresh fields via existing `resolveCard`; mint SA OAuth token (scope `wallet_object.issuer`, reusing `GOOGLE_WALLET_SA_*`); `PATCH walletobjects/v1/genericObject/{issuerId}.{serial}` (id computed at runtime). `404` ⇒ object never created (not saved) → skip without error.
5. **Apple**: look up `wallet_pass_registrations` for the serial; send an **empty APNs push** (topic = pass type id) over HTTP/2 using a token-based JWT (`APNS_AUTH_KEY`/`APNS_KEY_ID`). `410` ⇒ token invalid → delete that registration.
6. Mark rows `done`; on failure set `failed`, `attempts++`, and `not_before = now() + backoff(attempts)`.

Coalescing keeps a card to one effective update per drain even if multiple reasons queued.

## Apple PassKit Web Service — `/api/wallet/apple/v1/...`

Five spec-mandated endpoints (Next.js route handlers, admin client + HMAC auth):

1. `POST /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}` — body `{pushToken}`; upsert `wallet_pass_registrations`. 201 new / 200 existing.
2. `DELETE /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}` — delete registration. 200.
3. `GET /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}?passesUpdatedSince={tag}` — return serials registered to this device with `content_tag > tag`. 200 `{lastUpdated, serialNumbers}` or 204 if none.
4. `GET /v1/passes/{passTypeIdentifier}/{serialNumber}` — regenerate fresh `.pkpass` via `buildPassForCard(resolveCard(serial))`; honor `If-Modified-Since` → 304; else 200 + `Last-Modified: content_tag`.
5. `POST /v1/log` — record device-reported errors via logger. 200.

**Auth = stateless HMAC token.** `authenticationToken = hex(hmac_sha256(WALLET_PASS_AUTH_SECRET, serialNumber))`. All endpoints validate `Authorization: ApplePass {token}` by recompute + constant-time compare. No per-pass secret storage.

## Issuance Changes (code "migration")

- **`apple-wallet.service.ts`**: every new pass gets `webServiceURL = {NEXT_PUBLIC_SITE_URL}/api/wallet/apple` and `authenticationToken = hmac(serial)`. Without both, registration/update is impossible. This is what makes new (but not old) Apple passes sync.
- **Google save action** (`wallet.actions.ts` → `getGoogleWalletSaveUrl`) and **Apple route** (`/api/wallet/apple/[code]`): upsert the `wallet_passes` row on generation — set `google_save_requested_at` or `apple_pass_issued_at` — so later changes can find the pass.

## Data Backfill (existing passes)

- **Google**: insert `wallet_passes` rows for activated cards whose holder has `cardholder_profiles.google_wallet_added_at` set (optimistic save signal), stamping `google_save_requested_at`. Org-wide changes then reach existing Google passes on the first drain. `404`s from Google (saves that never completed) are absorbed harmlessly.
- **Apple**: none possible — existing passes are un-syncable by construction; documented for support.

## Secrets / Config

| name | purpose | new? |
|---|---|---|
| `APNS_AUTH_KEY` | APNs `.p8` private key (PEM, `\n`-escaped) | new |
| `APNS_KEY_ID` | APNs key id | new |
| `WALLET_PASS_AUTH_SECRET` | HMAC secret for Apple pass auth tokens | new |
| `CRON_SECRET` | bearer guarding `/api/wallet/sync` | new |
| `APPLE_WALLET_TEAM_ID` | reused as APNs team id | existing |
| `APPLE_WALLET_PASS_TYPE_ID` | reused as APNs topic | existing |
| `GOOGLE_WALLET_SA_EMAIL` / `GOOGLE_WALLET_SA_PRIVATE_KEY` | SA OAuth for `PATCH genericObject` | existing |

## Apple Operator Provisioning (one-time setup)

**TL;DR — what's new vs. reused:**

| Credential | Action | Why |
|---|---|---|
| Pass signing cert (`APPLE_WALLET_SIGNER_CERT_PEM`/`_KEY_PEM`) | **Reuse as-is** | Still signs the `.pkpass`. Sync does not touch signing. |
| WWDR cert (`APPLE_WALLET_WWDR_CERT_PEM`) | **Reuse as-is** | Unchanged. |
| Pass Type ID (`pass.com.tailgate.card`) | **Reuse** — must already exist (it does) | Doubles as the APNs **topic** for pass pushes. |
| **APNs Auth Key (`.p8`)** | **Create new** (one-time) | Token-based APNs auth for sending update pushes. |
| `WALLET_PASS_AUTH_SECRET`, `CRON_SECRET` | **Generate new** random strings | App-side secrets; not Apple artifacts. |

### Step 1 — Create the APNs Auth Key (.p8)

This is the **only** new Apple credential. It is **separate from** the pass signing certificate and does **not** replace or affect it.

1. Apple Developer portal → **Certificates, Identifiers & Profiles → Keys → +** (https://developer.apple.com/account/resources/authkeys/list).
2. Name it (e.g. `Tailgate Wallet APNs`), check **Apple Push Notifications service (APNs)**, Continue → Register.
3. **Download the `.p8`** — this is a **one-time download**; Apple never shows the private key again. Store it in the password manager / secret store.
4. Record the **Key ID** (shown on the key page) → `APNS_KEY_ID`.
5. The **Team ID** is the same one already in `APPLE_WALLET_TEAM_ID` → reused as the APNs team id (no new value).

> One token-based `.p8` key works for **all** topics under the team, including pass updates — no per-pass-type key needed, and the key does **not expire** (unlike certs). If a key already exists for another purpose it can be reused; otherwise create a dedicated one so it can be revoked independently.

### Step 2 — No portal registration of the web service

`webServiceURL` is **embedded in the pass itself** (`{NEXT_PUBLIC_SITE_URL}/api/wallet/apple`). Apple devices call it directly after install — there is **nothing to register** in the developer portal for the web service. Just ensure the URL is publicly reachable over HTTPS in each environment (it won't work against `localhost`; use a tunnel/staging host to test device registration).

### Step 3 — Wire env vars

- `APNS_AUTH_KEY` = contents of the `.p8` (PEM; escape newlines as `\n`, matching the existing `APPLE_WALLET_*_PEM` convention).
- `APNS_KEY_ID` = the Key ID from Step 1.
- `WALLET_PASS_AUTH_SECRET` = `openssl rand -hex 32`.
- `CRON_SECRET` = `openssl rand -hex 32` (and set it on the Vercel Cron job).
- Add all four to local `.env`, and to Vercel project envs (Production + Preview).
- APNs host is `api.push.apple.com` (production); the worker targets it over HTTP/2. Passes built by the production signing cert register against the production APNs host — there is no separate sandbox host for Wallet pushes.

### Step 4 — Rollout ordering

1. Provision the `.p8` + secrets **before** deploying issuance changes.
2. Deploy issuance changes (passes now embed `webServiceURL` + token) → newly-saved Apple passes start registering.
3. Deploy worker + Vercel Cron last. Existing Apple passes never register (no embedded URL) and are expected to stay static; existing Google passes sync on the first drain after backfill.

## Error Handling

Follows the repo standard (typed codes + correlation id + Sentry; uniform-but-trackable on anon endpoints). New `WalletErrorCode`s as needed: `WALLET_SYNC_FAILED`, `WALLET_REGISTRATION_INVALID`, `WALLET_PASS_AUTH_FAILED`. APNs `410` → prune registration (not an error); Google `404` → mark not-saved (not an error). Worker failures are retried with backoff via `not_before`/`attempts`; persistent failures stay `failed` for inspection.

## Testing

- **DB (pgTAP)**: trigger enqueue for each change type; org-fan-out via partnerships; queue coalescing; RLS denies non-service access.
- **Unit**: HMAC token generate/verify (constant-time); APNs JWT signing; Google OAuth token mint; `passesUpdatedSince` filter logic.
- **Route handlers**: register/unregister/passesUpdatedSince/pass-refetch (304 path)/log; worker claim + Google PATCH (404 path) + Apple push (410 prune) with mocked outbound HTTP.
- **E2E (Playwright)**: save flow still issues a valid pass; smoke that a discount edit enqueues a job.

## Open / Deferred

- Vercel Cron assumes prod deploys on Vercel — confirmed as the scheduler.
- No inline push on cancellation (cron-only ~1 min is accepted).
- Google batch/quota tuning deferred until fan-out volumes are observed; worker batches per drain.
