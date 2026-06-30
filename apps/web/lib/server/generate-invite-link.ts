import 'server-only';

import { SupabaseClient, User } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

interface GenerateEntityInviteLinkParams {
  adminClient: SupabaseClient<Database>;
  email: string;
  displayName: string;
  siteUrl: string;
  redirectTo: string;
}

interface GenerateEntityInviteLinkResult {
  user: User;
  inviteLink: string;
}

/**
 * Creates a new auth user via generateLink (type: 'invite') and builds
 * a custom invite link without sending Supabase's default email.
 */
export async function generateEntityInviteLink(
  params: GenerateEntityInviteLinkParams,
): Promise<GenerateEntityInviteLinkResult> {
  const { adminClient, email, displayName, siteUrl, redirectTo } = params;

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { display_name: displayName },
      redirectTo,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error('Failed to generate invite link');
  }

  // Extract token from Supabase's generated action link
  const actionLink = data.properties?.action_link;

  if (!actionLink) {
    throw new Error('action_link not found in generateLink response');
  }

  const token = new URL(actionLink).searchParams.get('token');

  if (!token) {
    throw new Error('Token not found in generated invite link');
  }

  // Build our own auth confirm URL
  const authConfirmUrl = new URL('/auth/confirm', siteUrl);
  authConfirmUrl.searchParams.set('token_hash', token);
  authConfirmUrl.searchParams.set('type', 'invite');
  authConfirmUrl.searchParams.set('next', redirectTo);

  return {
    user: data.user,
    inviteLink: authConfirmUrl.toString(),
  };
}
