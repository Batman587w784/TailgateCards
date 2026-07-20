import 'server-only';

import { z } from 'zod';

// Thin wrapper over the GroupMe v3 API. Per their docs the user access token is
// always sent in the X-Access-Token header (never the query string). Creating a
// bot needs the token; posting as a bot needs only the bot_id.
const GROUPME_API = 'https://api.groupme.com/v3';

export function getGroupMeClientId(): string {
  return z
    .string()
    .min(1, { message: 'GROUPME_CLIENT_ID is not set' })
    .parse(process.env.GROUPME_CLIENT_ID);
}

export interface GroupMeGroup {
  id: string;
  name: string;
  image_url: string | null;
}

async function groupmeJson<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const res = await fetch(`${GROUPME_API}${path}`, {
    ...init,
    // GroupMe is an external service; never cache these calls.
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`GroupMe ${path} failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { response: T };
  return json.response;
}

/** List the authorizing user's groups (for the connect picker). */
export async function listGroups(token: string): Promise<GroupMeGroup[]> {
  const out: GroupMeGroup[] = [];

  // Most officers are in a handful of groups; cap the paging so a huge account
  // can't stall the picker.
  for (let page = 1; page <= 5; page++) {
    const rows = await groupmeJson<
      Array<{ id: string; name: string; image_url: string | null }>
    >(`/groups?omit=memberships&per_page=100&page=${page}`, {
      method: 'GET',
      headers: { 'X-Access-Token': token },
    });

    if (!rows.length) break;
    for (const g of rows) {
      out.push({ id: g.id, name: g.name, image_url: g.image_url ?? null });
    }
    if (rows.length < 100) break;
  }

  return out;
}

/** Register a Tailgate bot in a group; returns the bot_id used for future posts. */
export async function createBot(params: {
  token: string;
  groupId: string;
  name: string;
  avatarUrl?: string | null;
}): Promise<string> {
  const bot = await groupmeJson<{ bot_id?: string; bot?: { bot_id: string } }>(
    `/bots`,
    {
      method: 'POST',
      headers: {
        'X-Access-Token': params.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot: {
          name: params.name,
          group_id: params.groupId,
          avatar_url: params.avatarUrl ?? undefined,
        },
      }),
    },
  );

  const botId = bot.bot_id ?? bot.bot?.bot_id;
  if (!botId) throw new Error('GroupMe /bots returned no bot_id');
  return botId;
}

export interface BotPostResult {
  ok: boolean;
  /** 404 means the bot was removed from the group — our over-posting off-switch. */
  removed: boolean;
  status: number;
}

/** Post a message as the bot. No user token required — bot_id is the credential. */
export async function postBotMessage(
  botId: string,
  text: string,
): Promise<BotPostResult> {
  const res = await fetch(`${GROUPME_API}/bots/post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ bot_id: botId, text }),
  });

  return { ok: res.ok, removed: res.status === 404, status: res.status };
}
