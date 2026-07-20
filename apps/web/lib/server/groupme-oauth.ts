import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { getGroupMeClientId } from './groupme-api';

// GroupMe uses the OAuth *implicit* flow: we redirect to the authorize URL and it
// redirects back to our pre-registered callback with ?access_token=... in the
// query string. There is no `state` parameter and no code exchange, so CSRF and
// flow-continuity are carried entirely by our own signed, httpOnly cookies:
//   - gm_nonce: a signed random value set before the redirect and required (valid
//     signature) on the callback — proves the browser actually started a connect.
//   - gm_pending: after the callback stores the token in vault, this signed cookie
//     carries only {orgId, secretId} (an inert vault pointer, never the token)
//     forward to the group-picker step.
export const GROUPME_NONCE_COOKIE = 'gm_nonce';
export const GROUPME_PENDING_COOKIE = 'gm_pending';

// Both cookies are short-lived; the flow is a few clicks.
export const GROUPME_COOKIE_MAX_AGE = 60 * 15; // 15 minutes

function signingSecret(): string {
  // Reuse the service-role key as the HMAC key — a stable, server-only secret. It
  // signs (never encrypts) these cookies and is never shipped to the client.
  // REVIEW: swap to a dedicated GROUPME_STATE_SECRET if we want key separation.
  const secret =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('No server secret available to sign GroupMe cookies');
  return secret;
}

function sign(value: string): string {
  const mac = createHmac('sha256', signingSecret()).update(value).digest('base64url');
  return `${value}.${mac}`;
}

function verify(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;

  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = createHmac('sha256', signingSecret())
    .update(value)
    .digest('base64url');

  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

export function buildAuthorizeUrl(): string {
  return `https://oauth.groupme.com/oauth/authorize?client_id=${encodeURIComponent(
    getGroupMeClientId(),
  )}`;
}

/** A fresh signed CSRF nonce for the gm_nonce cookie. */
export function issueNonce(): string {
  return sign(randomBytes(16).toString('hex'));
}

/** True if the presented nonce cookie carries our signature. */
export function verifyNonce(cookieValue: string | undefined | null): boolean {
  return verify(cookieValue) !== null;
}

interface PendingConnect {
  orgId: string;
  secretId: string;
}

export function signPending(pending: PendingConnect): string {
  const payload = Buffer.from(JSON.stringify(pending)).toString('base64url');
  return sign(payload);
}

export function readPending(
  cookieValue: string | undefined | null,
): PendingConnect | null {
  const payload = verify(cookieValue);
  if (!payload) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as PendingConnect;
    if (!parsed.orgId || !parsed.secretId) return null;
    return parsed;
  } catch {
    return null;
  }
}
