# Wallet pass sync

Keeps already-saved Apple/Google wallet passes in step with later card changes
(expiry, discount list, org/batch name, card status).

How it works: DB triggers enqueue change events into `wallet_sync_queue`. A
Vercel-Cron-driven worker (`GET /api/wallet/sync`, ~1 min) drains the queue —
it `PATCH`es Google Wallet objects directly (works for already-saved passes) and
sends APNs pushes to Apple devices registered via the PassKit web service below.
Only Apple passes issued *after* this shipped can sync (they embed a
`webServiceURL` + HMAC auth token); older Apple passes can't be retrofitted.

## Routes

| Route | Purpose |
| --- | --- |
| `GET /api/wallet/sync` | Queue-draining worker. Auth: `Authorization: Bearer ${CRON_SECRET}`. |
| `POST/DELETE /api/wallet/apple/v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}` | Device register / unregister. Auth: `Authorization: ApplePass {token}`. |
| `GET /api/wallet/apple/v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}` | `passesUpdatedSince` — serials changed since a tag. |
| `GET /api/wallet/apple/v1/passes/{passTypeIdentifier}/{serialNumber}` | Latest signed `.pkpass` (honors `If-Modified-Since` → 304). Auth: `ApplePass {token}`. |
| `POST /api/wallet/apple/v1/log` | Apple device error log sink (always 200). |

The `ApplePass {token}` value is `HMAC-SHA256(WALLET_PASS_AUTH_SECRET, serialNumber)`
(see `app/activate/_lib/server/pass-auth-token.ts`).

## Environment

Set these in `apps/web/.env` (local) and the Vercel project env (deployed). See
`docs/superpowers/specs/2026-06-10-wallet-pass-sync-design.md` → *Apple Operator
Provisioning* for how to obtain each.

| Var | Required for | Notes |
| --- | --- | --- |
| `WALLET_PASS_AUTH_SECRET` | Apple pass updates | HMAC secret for pass auth tokens. `openssl rand -hex 32`. Without it, newly-issued passes are non-updatable. |
| `CRON_SECRET` | The worker | Guards `/api/wallet/sync`. Vercel Cron auto-sends it as `Bearer`. `openssl rand -hex 32`. |
| `APNS_AUTH_KEY` | Apple pushes | `.p8` contents, newlines escaped as `\n`. |
| `APNS_KEY_ID` | Apple pushes | Key ID from developer.apple.com → Keys. |
| `APPLE_WALLET_TEAM_ID` | Apple pushes | Reused as the APNs team id. |
| `APPLE_WALLET_PASS_TYPE_ID` | Apple pushes | Reused as the APNs topic (must equal the Pass Type ID). |
| `NEXT_PUBLIC_SITE_URL` | Apple pass updates | `webServiceURL` is derived from it; must be public HTTPS in production (won't work against localhost). |
| `GOOGLE_WALLET_*` | Google updates | Same issuer/class/SA vars used by the save flow. |
