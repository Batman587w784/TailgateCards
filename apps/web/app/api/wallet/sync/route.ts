import { NextResponse } from 'next/server';

import { timingSafeEqual } from 'node:crypto';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { sendPassUpdatePush } from '~/activate/_lib/server/apns.service';
import { updateGoogleWalletObject } from '~/activate/_lib/server/google-wallet-update.service';
import { resolveCard } from '~/activate/_lib/server/resolve-card';
import {
  bumpContentTags,
  deleteRegistrationByToken,
  loadRegistrationsForSerial,
  loadWalletPasses,
  resolveAffectedCardIds,
} from '~/activate/_lib/server/wallet-pass.repository';

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

      // Cards whose Google/APNs delivery did not succeed this drain. Their
      // card-scope jobs are parked as `failed` for inspection rather than
      // silently marked done; one bad card never aborts the others.
      const failedCardIds = new Set<string>();

      for (const pass of passes) {
        try {
          const resolved = await resolveCard(pass.serial_number);
          if (!resolved) continue;

          // Google: only if the card was offered to Google AND the serial still
          // resolves to the SAME org this pass belongs to. A digital
          // `D-NNNNNN` serial is unique only per-org, so resolveCard could
          // otherwise pick another org's card and PATCH the wrong saved object.
          if (
            pass.google_save_requested_at &&
            resolved.organizationId === pass.organization_id
          ) {
            const result = await updateGoogleWalletObject({
              cardCode: resolved.cardCode,
              cardType: resolved.cardType,
              organizationName: resolved.organizationName,
              batchName: resolved.batchName,
              expiresAt: resolved.expiresAt,
              discountCount: resolved.discountCount,
              discounts: resolved.discounts,
            });
            // 'not_saved' (404) is terminal-OK: the object was never created,
            // so there is nothing to update and no point retrying.
            if (result === 'failed') failedCardIds.add(pass.card_id);
          }

          // Apple: push every registered device; prune dead tokens.
          const tokens = await loadRegistrationsForSerial(
            admin,
            pass.serial_number,
          );
          for (const token of tokens) {
            const pushResult = await sendPassUpdatePush(token);
            if (pushResult.status === 'gone') {
              await deleteRegistrationByToken(admin, token);
            } else if (pushResult.status === 'failed') {
              failedCardIds.add(pass.card_id);
            }
          }
        } catch (passErr) {
          failedCardIds.add(pass.card_id);
          logger.error(
            { ...ctx, cardId: pass.card_id, err: passErr },
            'wallet sync: per-card failure',
          );
        }
      }

      // Card-scope jobs for a failed card are parked; everything else is done.
      // Org-scope jobs (discount fan-out) can't be attributed to a single card,
      // so they are always marked done — their content_tag bump means Apple
      // devices re-fetch on their own poll, and the next change re-syncs Google.
      const failedJobIds = jobs
        .filter(
          (j) =>
            j.scope === 'card' && j.card_id && failedCardIds.has(j.card_id),
        )
        .map((j) => j.id);
      const failedJobSet = new Set(failedJobIds);
      const doneJobIds = jobIds.filter((id) => !failedJobSet.has(id));
      const now = new Date().toISOString();

      if (doneJobIds.length > 0) {
        await admin
          .from('wallet_sync_queue')
          .update({ status: 'done', processed_at: now })
          .in('id', doneJobIds);
      }
      if (failedJobIds.length > 0) {
        await admin
          .from('wallet_sync_queue')
          .update({
            status: 'failed',
            last_error: 'pass delivery failed',
            not_before: new Date(
              Date.now() + BACKOFF_SECONDS * 1000,
            ).toISOString(),
          })
          .in('id', failedJobIds);
      }

      logger.info(
        {
          ...ctx,
          jobs: jobIds.length,
          cards: cardIds.length,
          failed: failedJobIds.length,
        },
        'wallet sync drain complete',
      );
      return NextResponse.json({
        processed: doneJobIds.length,
        failed: failedJobIds.length,
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
