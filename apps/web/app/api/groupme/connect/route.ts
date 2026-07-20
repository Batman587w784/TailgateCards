import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import appConfig from '~/config/app.config';
import { getGroupMeClientId } from '~/lib/server/groupme-api';
import {
  GROUPME_COOKIE_MAX_AGE,
  GROUPME_NONCE_COOKIE,
  buildAuthorizeUrl,
  issueNonce,
} from '~/lib/server/groupme-oauth';

const MANAGE_PATH = '/dashboard/org-admin/groupme';

// Step 1 of the connect flow: an org-admin kicks off GroupMe's implicit OAuth.
// We set a signed CSRF nonce cookie (sameSite=lax so it survives the redirect
// back from groupme.com) and bounce to the authorize URL. GroupMe returns to our
// pre-registered callback with the token.
export const GET = enhanceRouteHandler(
  async () => {
    const client = getSupabaseServerClient();

    const { data: role } = await client.rpc('get_platform_role');
    if (role !== 'org_admin') {
      return NextResponse.redirect(new URL('/dashboard', appConfig.url));
    }

    // If GROUPME_CLIENT_ID isn't configured, don't bounce to a broken authorize
    // page — send them back with a clear error.
    try {
      getGroupMeClientId();
    } catch {
      return NextResponse.redirect(
        new URL(`${MANAGE_PATH}?error=not_configured`, appConfig.url),
      );
    }

    const res = NextResponse.redirect(buildAuthorizeUrl());
    res.cookies.set(GROUPME_NONCE_COOKIE, issueNonce(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: GROUPME_COOKIE_MAX_AGE,
    });
    return res;
  },
  { auth: true },
);
