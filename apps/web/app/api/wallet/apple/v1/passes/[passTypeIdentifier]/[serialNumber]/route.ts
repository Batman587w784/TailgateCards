import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { buildPassForCard } from '~/activate/_lib/server/apple-wallet.service';
import {
  parseApplePassAuthorization,
  verifyPassAuthToken,
} from '~/activate/_lib/server/pass-auth-token';
import { resolveCard } from '~/activate/_lib/server/resolve-card';

// GET: return the latest signed .pkpass for a serial. Honors If-Modified-Since.
export const GET = enhanceRouteHandler(
  async ({ request, params }) => {
    const serialNumber = params.serialNumber!;
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
      organizationLogoUrl: resolved.organizationLogoUrl,
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
