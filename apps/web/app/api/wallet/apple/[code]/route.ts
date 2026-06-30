import { NextResponse } from 'next/server';

import { getServerMonitoringService } from '@kit/monitoring/server';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { buildPassForCard } from '~/activate/_lib/server/apple-wallet.service';
import { resolveCard } from '~/activate/_lib/server/resolve-card';
import { upsertWalletPass } from '~/activate/_lib/server/wallet-pass.repository';
import type { WalletErrorCode } from '~/activate/_lib/wallet-errors';
import { getCorrelationId } from '~/lib/server/action-context';

// Accept both code formats the wallet resolver supports (see resolveCard in
// wallet.actions.ts): physical cards are "ORG-BATCH-NUMBER" (3 segments) and
// digital cards are "D-NNNNNN" (2 segments). The earlier 3-segment-only
// pattern rejected every digital card with a 400.
const PHYSICAL_CODE_PATTERN = /^[A-Z0-9]+-[A-Z0-9]+-\d+$/i;
const DIGITAL_CODE_PATTERN = /^D-\d+$/i;


function isValidCardCode(code: string) {
  return PHYSICAL_CODE_PATTERN.test(code) || DIGITAL_CODE_PATTERN.test(code);
}

const HANDLER_NAME = 'appleWalletPass';

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const [reference, logger] = await Promise.all([
    getCorrelationId(),
    getLogger(),
  ]);

  if (!isValidCardCode(code)) {
    logger.warn(
      { name: HANDLER_NAME, reference, cardCode: code, code: 'INVALID_CODE' },
      `${HANDLER_NAME}: INVALID_CODE`,
    );
    return NextResponse.json(
      { code: 'INVALID_CODE', reference },
      { status: 400 },
    );
  }

  // No auth check by design — the pass content is just the card code text,
  // and the pass itself grants no entitlement (merchant validates redemption
  // against the DB at point of sale). Same threat model as the Google Wallet
  // save action (see google-wallet.service.ts).
  try {
    // Best-effort enrichment: a resolved card adds org name, expiry, batch and
    // offer count; an unresolved one degrades to a minimal code-only pass
    // rather than failing the download (the pass grants no entitlement).
    const resolved = await resolveCard(code);
    const buffer = await buildPassForCard(
      resolved ?? { cardCode: code.toUpperCase() },
    );

    // Best-effort: record the Apple offer so later card changes can push an
    // update to this pass (it ships with a webServiceURL + auth token). Only a
    // resolved card carries the ids; a failure here must not block the download.
    if (resolved) {
      try {
        await upsertWalletPass(getSupabaseServerAdminClient(), {
          cardId: resolved.cardId,
          serialNumber: resolved.cardCode,
          organizationId: resolved.organizationId,
          channel: 'apple',
        });
      } catch (recordErr) {
        logger.warn(
          { name: HANDLER_NAME, reference, cardCode: code, err: recordErr },
          `${HANDLER_NAME}: failed to record wallet_passes row`,
        );
      }
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="tailgate-${code}.pkpass"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';

    if (message === 'WALLET_NOT_CONFIGURED') {
      const code503: WalletErrorCode = 'WALLET_NOT_CONFIGURED';
      logger.warn(
        { name: HANDLER_NAME, reference, cardCode: code, code: code503 },
        `${HANDLER_NAME}: ${code503}`,
      );
      return NextResponse.json({ code: code503, reference }, { status: 503 });
    }

    // Unexpected signing/IO fault — log and report to Sentry, tagged with the
    // same reference the client receives, then return a generic 500.
    const failureCode: WalletErrorCode = 'WALLET_GENERATION_FAILED';
    logger.error(
      { name: HANDLER_NAME, reference, cardCode: code, code: failureCode, err },
      `${HANDLER_NAME}: ${failureCode}`,
    );

    const monitoring = await getServerMonitoringService();
    await monitoring.ready();
    monitoring.captureException(err as Error, {
      action: HANDLER_NAME,
      reference,
    });

    return NextResponse.json({ code: failureCode, reference }, { status: 500 });
  }
}
