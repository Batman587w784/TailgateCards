import { createHmac } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

/**
 * Apple PassKit Web Service contract tests.
 *
 * Two layers:
 *  - Auth-gate contract (always runs): a bad/absent ApplePass token is rejected
 *    with 401. Needs no seed and no secret — `verifyPassAuthToken` returns false
 *    when the secret is unset, so the gate still closes.
 *  - Seeded happy path (runs only when WALLET_PASS_AUTH_SECRET is set in this
 *    process AND matches the running web server's value): registers a device,
 *    lists it via passesUpdatedSince, and re-fetches the pass. Skipped otherwise
 *    so unconfigured CI/local runs stay green. The pass-binary assertion also
 *    needs Apple signing config (APPLE_WALLET_SIGNER_CERT_PEM).
 */

const SUPABASE_URL = 'http://127.0.0.1:54321';
// Well-known local-dev service_role key (same one used in authentication/auth.po.ts).
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const SERIAL = 'D-009001';
const DIGITAL_NUMBER = 9001;
const DEVICE = 'e2e-device-001';
const PASS_TYPE =
  process.env.APPLE_WALLET_PASS_TYPE_ID ?? 'pass.com.tailgate.card';

const authSecret = process.env.WALLET_PASS_AUTH_SECRET;
const hasSigning = Boolean(process.env.APPLE_WALLET_SIGNER_CERT_PEM);

function token(serial: string) {
  return createHmac('sha256', authSecret!).update(serial).digest('hex');
}

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

const regPath = `/api/wallet/apple/v1/devices/${DEVICE}/registrations/${PASS_TYPE}/${SERIAL}`;
const listPath = `/api/wallet/apple/v1/devices/${DEVICE}/registrations/${PASS_TYPE}`;
const passPath = `/api/wallet/apple/v1/passes/${PASS_TYPE}/${SERIAL}`;

test.describe('Apple PassKit — auth gate (always runs)', () => {
  test('rejects registration with a bad auth token', async ({ request }) => {
    const res = await request.post(regPath, {
      headers: { Authorization: 'ApplePass deadbeef' },
      data: { pushToken: 'tok-1' },
    });
    expect(res.status()).toBe(401);
  });

  test('rejects pass re-fetch with a bad auth token', async ({ request }) => {
    const res = await request.get(passPath, {
      headers: { Authorization: 'ApplePass deadbeef' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('Apple PassKit — seeded happy path', () => {
  test.skip(
    !authSecret,
    'Set WALLET_PASS_AUTH_SECRET (matching the web server) to run these.',
  );

  test.beforeAll(async () => {
    const client = admin();

    const { data: user } = await client.auth.admin.createUser({
      email: `passkit-${Date.now()}@test.com`,
      password: 'testingpassword',
      email_confirm: true,
    });

    const { data: account } = await client
      .from('accounts')
      .insert({
        name: 'PassKit Org',
        is_personal_account: false,
        primary_owner_user_id: user!.user.id,
      })
      .select('id')
      .single();

    const { data: card } = await client
      .from('cards')
      .insert({
        organization_id: account!.id,
        card_type: 'digital',
        digital_card_number: DIGITAL_NUMBER,
        status: 'activated',
      })
      .select('id')
      .single();

    await client.from('wallet_passes').upsert(
      {
        card_id: card!.id,
        serial_number: SERIAL,
        organization_id: account!.id,
      },
      { onConflict: 'card_id' },
    );
  });

  test('registers a device then lists it via passesUpdatedSince', async ({
    request,
  }) => {
    const reg = await request.post(regPath, {
      headers: { Authorization: `ApplePass ${token(SERIAL)}` },
      data: { pushToken: 'tok-1' },
    });
    expect([200, 201]).toContain(reg.status());

    const list = await request.get(listPath);
    expect(list.status()).toBe(200);
    const body = await list.json();
    expect(body.serialNumbers).toContain(SERIAL);
  });

  test('serves a pkpass for a valid token', async ({ request }) => {
    test.skip(
      !hasSigning,
      'Set APPLE_WALLET_SIGNER_CERT_PEM (full Apple signing config) to run this.',
    );
    const ok = await request.get(passPath, {
      headers: { Authorization: `ApplePass ${token(SERIAL)}` },
    });
    expect(ok.status()).toBe(200);
    expect(ok.headers()['content-type']).toContain('apple.pkpass');
  });
});
