'use server';

import 'server-only';

import { z } from 'zod';

import { RefinedPasswordSchema } from '@kit/auth/schemas/password';
import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

const SetupPasswordActionSchema = z.object({
  inviteToken: z.string().min(1),
  password: RefinedPasswordSchema,
});

export const setInvitedUserPassword = enhanceAction(
  async (data) => {
    const logger = await getLogger();
    const ctx = { name: 'setInvitedUserPassword' };

    const { inviteToken, password } = data;

    const adminClient = getSupabaseServerAdminClient();

    // Validate invite_token against invitations table
    const { data: invitation, error: invitationError } = await adminClient
      .from('invitations')
      .select('email')
      .eq('invite_token', inviteToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (invitationError || !invitation) {
      logger.warn(
        { ...ctx, error: invitationError },
        'Invalid or expired invitation token',
      );

      return {
        success: false,
        error: 'This invitation link is invalid or has expired.',
      };
    }

    const email = invitation.email;

    // Look up user via accounts table, then get auth user by ID
    const { data: account, error: accountError } = await adminClient
      .from('accounts')
      .select('primary_owner_user_id')
      .eq('email', email)
      .eq('is_personal_account', true)
      .single();

    if (accountError || !account?.primary_owner_user_id) {
      logger.error(
        { ...ctx, email, error: accountError },
        'Account not found for invitation email',
      );

      return { success: false, error: 'Account not found. Please try again.' };
    }

    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(account.primary_owner_user_id);

    if (userError || !userData?.user) {
      logger.error(
        { ...ctx, userId: account.primary_owner_user_id, error: userError },
        'User not found in auth',
      );

      return { success: false, error: 'Account not found. Please try again.' };
    }

    const user = userData.user;

    // Verify user needs password setup
    if (!user.user_metadata?.needs_password) {
      logger.warn(
        { ...ctx, userId: user.id, email },
        'User does not need password setup',
      );

      return {
        success: false,
        error: 'Password has already been set for this account.',
      };
    }

    // Set password and clear the needs_password flag
    const { error: passwordError } =
      await adminClient.auth.admin.updateUserById(user.id, {
        password,
        user_metadata: {
          ...user.user_metadata,
          needs_password: false,
        },
      });

    if (passwordError) {
      logger.error(
        { ...ctx, userId: user.id, error: passwordError },
        'Failed to set password',
      );

      return {
        success: false,
        error: 'Failed to set password. Please try again.',
      };
    }

    logger.info(
      { ...ctx, userId: user.id },
      'Password set successfully for invited user',
    );

    return { success: true };
  },
  {
    schema: SetupPasswordActionSchema,
    auth: false,
  },
);
