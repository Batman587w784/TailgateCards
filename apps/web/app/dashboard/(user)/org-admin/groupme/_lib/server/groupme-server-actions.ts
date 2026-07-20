'use server';

import { cookies } from 'next/headers';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  createBot,
  destroyBot,
  postBotMessage,
} from '~/lib/server/groupme-api';
import { composeDrop } from '~/lib/server/groupme-drop';
import {
  GROUPME_PENDING_COOKIE,
  readPending,
} from '~/lib/server/groupme-oauth';

import { orgAdminAction } from '../../../../_lib/server/role-guards';
import { getUserOrganizationId } from '../../../../_lib/server/role-guards';

const SelectGroupSchema = z.object({
  groupId: z.string().min(1),
  groupName: z.string().min(1).max(200),
});

const BOT_NAME = 'Tailgate';

// Finishes the connect flow: reads the vault token (via the {orgId, secretId}
// pending cookie), registers a bot in the chosen group, persists the connection,
// and posts a first drop immediately so the officer sees it work (#3) instead of
// waiting a week and assuming it's broken.
export const selectGroupAction = orgAdminAction(
  enhanceAction(
    async (data) => {
      const logger = await getLogger();
      const ctx = { name: 'groupme.select' };

      const cookieStore = await cookies();
      const pending = readPending(
        cookieStore.get(GROUPME_PENDING_COOKIE)?.value,
      );
      if (!pending) return { success: false as const, error: 'expired' };

      // The cookie's org must match the acting org — never bind a group to a
      // chapter other than the one the officer administers.
      const orgId = await getUserOrganizationId();
      if (!orgId || orgId !== pending.orgId) {
        return { success: false as const, error: 'org_mismatch' };
      }

      const client = getSupabaseServerClient();
      const {
        data: { user },
      } = await client.auth.getUser();

      const admin = getSupabaseServerAdminClient();

      try {
        const { data: token } = await admin.rpc('groupme_read_token', {
          p_secret_id: pending.secretId,
        });
        if (!token) return { success: false as const, error: 'no_token' };

        const botId = await createBot({
          token,
          groupId: data.groupId,
          name: BOT_NAME,
        });

        const nowIso = new Date().toISOString();

        const { error } = await admin.from('groupme_connections').upsert(
          {
            organization_id: orgId,
            bot_id: botId,
            group_id: data.groupId,
            group_name: data.groupName,
            token_secret_id: pending.secretId,
            weekly_enabled: true,
            connected_by: user?.id ?? null,
            last_posted_at: nowIso,
          },
          { onConflict: 'organization_id' },
        );
        if (error) throw error;

        // First drop — real standings if we have them, else a friendly intro.
        const drop = await composeDrop(admin, orgId);
        const firstMessage = drop
          ? `✅ Connected to Tailgate!\n\n${drop}`
          : `✅ Tailgate is connected! Weekly standings — leaderboard, prize progress, and the countdown — will post here.`;
        await postBotMessage(botId, firstMessage);
      } catch (err) {
        logger.error({ ...ctx, err }, 'groupme select: connect failed');
        return { success: false as const, error: 'connect_failed' };
      }

      // Pending state consumed; clear it.
      cookieStore.set(GROUPME_PENDING_COOKIE, '', { path: '/', maxAge: 0 });

      return { success: true as const, groupName: data.groupName };
    },
    { schema: SelectGroupSchema },
  ),
);

const ToggleWeeklySchema = z.object({ enabled: z.boolean() });

// Chapter-mutable cadence switch (#10) — pause/resume the weekly drop.
export const toggleWeeklyAction = orgAdminAction(
  enhanceAction(
    async (data) => {
      const orgId = await getUserOrganizationId();
      if (!orgId) return { success: false as const };

      const admin = getSupabaseServerAdminClient();
      const { error } = await admin
        .from('groupme_connections')
        .update({ weekly_enabled: data.enabled })
        .eq('organization_id', orgId);

      return { success: !error };
    },
    { schema: ToggleWeeklySchema },
  ),
);

// Disconnect: remove our bot from GroupMe (best-effort) and drop the connection.
export const disconnectAction = orgAdminAction(
  enhanceAction(
    async () => {
      const orgId = await getUserOrganizationId();
      if (!orgId) return { success: false as const };

      const admin = getSupabaseServerAdminClient();
      const { data: conn } = await admin
        .from('groupme_connections')
        .select('bot_id, token_secret_id')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (conn?.token_secret_id && conn.bot_id) {
        const { data: token } = await admin.rpc('groupme_read_token', {
          p_secret_id: conn.token_secret_id,
        });
        if (token) await destroyBot(token, conn.bot_id);
      }

      const { error } = await admin
        .from('groupme_connections')
        .delete()
        .eq('organization_id', orgId);

      // REVIEW: the vault secret is left in place; a reconnect overwrites it by name.
      return { success: !error };
    },
    { schema: z.object({}) },
  ),
);
