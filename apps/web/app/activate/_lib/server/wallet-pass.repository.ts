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
