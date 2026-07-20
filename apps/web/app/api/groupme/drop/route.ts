import { NextResponse } from 'next/server';

import { timingSafeEqual } from 'node:crypto';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { groupmeShouldPost } from '~/lib/groupme-cadence';
import { postBotMessage } from '~/lib/server/groupme-api';
import { composeDrop, districtDaysLeft } from '~/lib/server/groupme-drop';

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// GET: the weekly GroupMe standings drop. Vercel Cron hits this daily; the cadence
// gate (groupmeShouldPost) decides per-connection whether it's time — weekly
// normally, ramping to every ~2 days in the final week and daily in the final 48h
// of the competition window. Invoked with Authorization: Bearer CRON_SECRET.
export const GET = enhanceRouteHandler(
  async ({ request }) => {
    if (!authorized(request)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const logger = await getLogger();
    const admin = getSupabaseServerAdminClient();
    const ctx = { name: 'groupme.drop' };
    const nowMs = Date.now();

    const { data: connections, error } = await admin
      .from('groupme_connections')
      .select('organization_id, bot_id, last_posted_at')
      .eq('weekly_enabled', true);

    if (error) {
      logger.error({ ...ctx, error: error.message }, 'load connections failed');
      return new Response('Server Error', { status: 500 });
    }
    if (!connections || connections.length === 0) {
      return NextResponse.json({ posted: 0, skipped: 0 });
    }

    let posted = 0;
    let skipped = 0;
    let removed = 0;
    let failed = 0;

    for (const conn of connections) {
      try {
        const daysLeft = await districtDaysLeft(admin, conn.organization_id);
        if (!groupmeShouldPost(daysLeft, conn.last_posted_at, nowMs)) {
          skipped++;
          continue;
        }

        const text = await composeDrop(admin, conn.organization_id);
        if (!text) {
          skipped++;
          continue;
        }

        const result = await postBotMessage(conn.bot_id, text);

        // 404 = the bot was removed from the group. That's the chapter's opt-out
        // for over-posting (#10) — respect it and stop trying.
        if (result.removed) {
          await admin
            .from('groupme_connections')
            .update({ weekly_enabled: false })
            .eq('organization_id', conn.organization_id);
          removed++;
          logger.info(
            { ...ctx, org: conn.organization_id },
            'groupme drop: bot removed, disabling connection',
          );
          continue;
        }

        if (!result.ok) {
          failed++;
          logger.warn(
            { ...ctx, org: conn.organization_id, status: result.status },
            'groupme drop: post failed',
          );
          continue;
        }

        await admin
          .from('groupme_connections')
          .update({ last_posted_at: new Date(nowMs).toISOString() })
          .eq('organization_id', conn.organization_id);
        posted++;
      } catch (err) {
        failed++;
        logger.error(
          { ...ctx, org: conn.organization_id, err },
          'groupme drop: per-connection failure',
        );
      }
    }

    logger.info({ ...ctx, posted, skipped, removed, failed }, 'groupme drop complete');
    return NextResponse.json({ posted, skipped, removed, failed });
  },
  { auth: false },
);
