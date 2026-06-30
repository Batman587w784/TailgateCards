import { NextRequest, NextResponse } from 'next/server';

import { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { Database } from '~/lib/database.types';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

/**
 * @name GET
 * @description Middleware route that validates team invitation and handles auth flow.
 *
 * Flow for NEW users:
 * 1. User clicks email link: /join/accept?invite_token=xxx
 * 2. Validate invitation exists and not expired (7-day window)
 * 3. Create user via admin API (no auto-authentication)
 * 4. Redirect to /join/setup-password for mandatory password setup
 * 5. User sets password, signs in, then proceeds to /join
 *
 * Flow for EXISTING users (with password):
 * 1. User clicks email link: /join/accept?invite_token=xxx
 * 2. Validate invitation exists and not expired
 * 3. Generate magiclink auth token
 * 4. Redirect to /auth/confirm → /join
 */
export async function GET(request: NextRequest) {
  const logger = await getLogger();
  const { searchParams } = new URL(request.url);
  const inviteToken = searchParams.get('invite_token');

  const ctx = {
    name: 'join.accept',
    inviteToken,
  };

  // Validate invite token is provided
  if (!inviteToken) {
    logger.warn(ctx, 'Missing invite_token parameter');

    return redirectToError('Invalid invitation link');
  }

  try {
    const adminClient = getSupabaseServerAdminClient();

    // Query invitation from database
    const { data: invitation, error: invitationError } = await adminClient
      .from('invitations')
      .select('*')
      .eq('invite_token', inviteToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    // Handle invitation not found or expired
    if (invitationError || !invitation) {
      logger.warn(
        {
          ...ctx,
          error: invitationError,
        },
        'Invitation not found or expired',
      );

      return redirectToError('Invitation not found or expired');
    }

    logger.info(
      {
        ...ctx,
        invitationId: invitation.id,
        email: invitation.email,
      },
      'Valid invitation found. Processing...',
    );

    // Determine if user exists
    const userStatus = await determineUserStatus(adminClient, invitation.email);

    logger.info(
      {
        ...ctx,
        userStatus: userStatus.type,
        email: invitation.email,
      },
      'Determined user status for invitation',
    );

    // NEW USER: Create account and redirect to password setup
    if (userStatus.type === 'new') {
      logger.info(
        { ...ctx, email: invitation.email },
        'Creating new user for invitation',
      );

      const { error: createError } = await adminClient.auth.admin.createUser({
        email: invitation.email,
        email_confirm: true,
        user_metadata: {
          needs_password: true,
        },
      });

      if (createError) {
        // If user already exists (e.g., race condition), check their status
        if (createError.message?.includes('already been registered')) {
          logger.info(
            { ...ctx, email: invitation.email },
            'User already exists (race condition), redirecting to setup-password',
          );
        } else {
          logger.error({ ...ctx, error: createError }, 'Failed to create user');

          throw createError;
        }
      } else {
        // Wait for the DB trigger to create the personal account
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Redirect to password setup page
      const setupPasswordUrl = new URL('/join/setup-password', siteUrl);
      setupPasswordUrl.searchParams.set('invite_token', inviteToken);

      logger.info(
        { ...ctx, redirectUrl: setupPasswordUrl.pathname },
        'Redirecting new user to password setup',
      );

      return NextResponse.redirect(setupPasswordUrl);
    }

    // EXISTING USER (needs password): Redirect to password setup
    if (userStatus.type === 'needs_password') {
      logger.info(
        { ...ctx, email: invitation.email },
        'Existing user needs password, redirecting to setup',
      );

      const setupPasswordUrl = new URL('/join/setup-password', siteUrl);
      setupPasswordUrl.searchParams.set('invite_token', inviteToken);

      return NextResponse.redirect(setupPasswordUrl);
    }

    // EXISTING USER (has password): Use magiclink flow
    const generateLinkResponse = await adminClient.auth.admin.generateLink({
      email: invitation.email,
      type: 'magiclink',
    });

    if (generateLinkResponse.error) {
      logger.error(
        {
          ...ctx,
          error: generateLinkResponse.error,
        },
        'Failed to generate auth link',
      );

      throw generateLinkResponse.error;
    }

    // Extract token from generated link
    const verifyLink = generateLinkResponse.data.properties?.action_link;
    const token = new URL(verifyLink).searchParams.get('token');

    if (!token) {
      logger.error(ctx, 'Token not found in generated link');
      throw new Error('Token in verify link from Supabase Auth was not found');
    }

    // Build redirect URL to auth confirmation with fresh token
    const authCallbackUrl = new URL('/auth/confirm', siteUrl);

    // Add auth parameters
    authCallbackUrl.searchParams.set('token_hash', token);
    authCallbackUrl.searchParams.set('type', 'magiclink');

    // Add next parameter to redirect to join page after auth
    const joinUrl = new URL(pathsConfig.app.joinTeam, siteUrl);
    joinUrl.searchParams.set('invite_token', inviteToken);

    authCallbackUrl.searchParams.set('next', joinUrl.href);

    logger.info(
      {
        ...ctx,
        redirectUrl: authCallbackUrl.pathname,
      },
      'Redirecting existing user to auth confirmation',
    );

    // Redirect to auth confirmation
    return NextResponse.redirect(authCallbackUrl);
  } catch (error) {
    logger.error(
      {
        ...ctx,
        error,
      },
      'Failed to process invitation acceptance',
    );

    return redirectToError('An error occurred processing your invitation');
  }
}

type UserStatus =
  | { type: 'new' }
  | { type: 'needs_password' }
  | { type: 'existing' };

/**
 * @name determineUserStatus
 * @description Determines user status: new, needs_password, or existing (has password)
 */
async function determineUserStatus(
  adminClient: SupabaseClient<Database>,
  email: string,
): Promise<UserStatus> {
  // Check if user exists in accounts table
  const { data: account, error: accountError } = await adminClient
    .from('accounts')
    .select('primary_owner_user_id')
    .eq('email', email)
    .single();

  // If user not found in accounts, they're new
  if (accountError || !account) {
    return { type: 'new' };
  }

  // User exists — check if they need password setup
  if (account.primary_owner_user_id) {
    const { data: userData } = await adminClient.auth.admin.getUserById(
      account.primary_owner_user_id,
    );

    if (userData?.user?.user_metadata?.needs_password) {
      return { type: 'needs_password' };
    }
  }

  return { type: 'existing' };
}

/**
 * @name redirectToError
 * @description Redirects to join page with error message
 */
function redirectToError(message: string): NextResponse {
  const errorUrl = new URL(pathsConfig.app.joinTeam, siteUrl);

  errorUrl.searchParams.set('error', message);

  return NextResponse.redirect(errorUrl);
}
