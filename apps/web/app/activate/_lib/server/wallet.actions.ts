'use server';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type ActionContext,
  type ActionFailure,
  fail,
  withActionContext,
} from '~/lib/server/action-context';

import { GetGoogleWalletSaveUrlSchema } from '../schemas/wallet.schema';
import type { WalletErrorCode } from '../wallet-errors';
import { buildSaveUrlForCard } from './google-wallet.service';
import { resolveCard } from './resolve-card';
import { upsertWalletPass } from './wallet-pass.repository';

type Result = { success: true; url: string } | ActionFailure<WalletErrorCode>;

export const getGoogleWalletSaveUrl = enhanceAction(
  async ({ cardCode }): Promise<Result> =>
    withActionContext('getGoogleWalletSaveUrl', async (ctx) => {
      const resolved = await resolveCard(cardCode);
      if (!resolved) {
        return fail(ctx, 'CARD_NOT_FOUND', { detail: { cardCode } });
      }

      try {
        const url = await buildSaveUrlForCard(resolved);

        // Best-effort: record the Google offer so later card changes (expiry,
        // discounts, org/batch name) can sync to the already-saved pass. A
        // failure here must not block handing the user their save URL — the
        // pass simply won't sync until the card is saved again.
        try {
          await upsertWalletPass(getSupabaseServerAdminClient(), {
            cardId: resolved.cardId,
            serialNumber: resolved.cardCode,
            organizationId: resolved.organizationId,
            channel: 'google',
          });
        } catch (recordErr) {
          const logger = await getLogger();
          logger.warn(
            { name: 'getGoogleWalletSaveUrl', cardCode, err: recordErr },
            'Failed to record wallet_passes row for Google save',
          );
        }

        return { success: true as const, url };
      } catch (err) {
        return failFromWalletError(ctx, err, cardCode);
      }
    }),
  { auth: false, schema: GetGoogleWalletSaveUrlSchema },
);

/**
 * Maps the thrown sentinel from the wallet service to a typed, logged failure.
 * `WALLET_NOT_CONFIGURED` is an operator-config issue (warn); anything else is
 * an unexpected signing/IO fault (error).
 */
function failFromWalletError(
  ctx: ActionContext,
  err: unknown,
  cardCode: string,
): ActionFailure<WalletErrorCode> {
  const message = err instanceof Error ? err.message : '';

  if (message === 'WALLET_NOT_CONFIGURED') {
    return fail(ctx, 'WALLET_NOT_CONFIGURED', { detail: { cardCode } });
  }

  return fail(ctx, 'WALLET_GENERATION_FAILED', {
    detail: { cardCode, error: message },
    level: 'error',
  });
}
