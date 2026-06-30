import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

/**
 * Wallet sync worker contract tests.
 *
 *  - Auth-gate (always runs): the worker rejects any request without a valid
 *    `Authorization: Bearer ${CRON_SECRET}` with 401. When CRON_SECRET is unset
 *    on the server the gate still closes (authorized() returns false).
 *  - Drain path (runs only when CRON_SECRET is set in this process AND matches
 *    the running web server): seeds a wallet_passes row + a pending queue job,
 *    then asserts the worker advances state and reports processed >= 1. Skipped
 *    otherwise so unconfigured runs stay green.
 */

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const SERIAL = 'D-009101';
const DIGITAL_NUMBER = 9101;
const cronSecret = process.env.CRON_SECRET;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

test.describe('wallet sync worker — auth gate (always runs)', () => {
  test('rejects without the cron secret', async ({ request }) => {
    const res = await request.get('/api/wallet/sync');
    expect(res.status()).toBe(401);
  });

  test('rejects with a wrong cron secret', async ({ request }) => {
    const res = await request.get('/api/wallet/sync', {
      headers: { Authorization: 'Bearer not-the-secret' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('wallet sync worker — drain path', () => {
  test.skip(
    !cronSecret,
    'Set CRON_SECRET (matching the web server) to run the drain test.',
  );

  test('drains a pending job and reports processed >= 1', async ({
    request,
  }) => {
    const client = admin();

    const { data: user } = await client.auth.admin.createUser({
      email: `sync-${Date.now()}@test.com`,
      password: 'testingpassword',
      email_confirm: true,
    });

    const { data: account } = await client
      .from('accounts')
      .insert({
        name: 'Sync Org',
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

    await client.from('wallet_sync_queue').insert({
      scope: 'card',
      card_id: card!.id,
      reason: 'discounts',
    });

    const res = await request.get('/api/wallet/sync', {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.processed).toBeGreaterThanOrEqual(1);
  });
});
