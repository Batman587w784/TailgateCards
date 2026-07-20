import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '~/lib/database.types';

export interface GroupMeStatus {
  connected: boolean;
  group_name: string | null;
  weekly_enabled: boolean;
  last_posted_at: string | null;
}

export async function loadGroupMeStatus(
  client: SupabaseClient<Database>,
  orgId: string,
): Promise<GroupMeStatus> {
  const { data } = await client.rpc('get_groupme_connection_status', {
    p_org_id: orgId,
  });

  const status = data as unknown as Partial<GroupMeStatus> | null;
  return {
    connected: status?.connected ?? false,
    group_name: status?.group_name ?? null,
    weekly_enabled: status?.weekly_enabled ?? false,
    last_posted_at: status?.last_posted_at ?? null,
  };
}
