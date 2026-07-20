import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import appConfig from '~/config/app.config';
import { getUserOrganizationId } from '~/dashboard/(user)/_lib/server/role-guards';
import {
  GROUPME_COOKIE_MAX_AGE,
  GROUPME_NONCE_COOKIE,
  GROUPME_PENDING_COOKIE,
  signPending,
  verifyNonce,
} from '~/lib/server/groupme-oauth';

const MANAGE_PATH = '/dashboard/org-admin/groupme';
const SELECT_PATH = '/dashboard/org-admin/groupme/select';

function fail(reason: string) {
  return NextResponse.redirect(
    new URL(`${MANAGE_PATH}?error=${reason}`, appConfig.url),
  );
}

// Step 2: GroupMe redirects here with ?access_token=… (implicit flow — the token
// is unavoidably in the query string, so we never log the URL and immediately
// redirect to a clean path; browser history keeps only the clean URL).
// REVIEW: the token still transits our access logs on this one request — inherent
// to GroupMe's implicit flow; there is no code-exchange alternative.
//
// We verify the CSRF nonce, resolve the org from the authenticated session
// (GroupMe echoes no state, so the session is our source of truth for *which*
// chapter), encrypt the token into vault, and hand only the vault pointer forward.
export const GET = enhanceRouteHandler(
  async ({ request }) => {
    const logger = await getLogger();
    const ctx = { name: 'groupme.callback' };

    const accessToken = request.nextUrl.searchParams.get('access_token');
    if (!accessToken) return fail('no_token');

    const nonce = request.cookies.get(GROUPME_NONCE_COOKIE)?.value;
    if (!verifyNonce(nonce)) {
      logger.warn(ctx, 'groupme callback: bad or missing CSRF nonce');
      return fail('csrf');
    }

    // Only an org-admin can bind a GroupMe group to their chapter.
    const client = getSupabaseServerClient();
    const { data: role } = await client.rpc('get_platform_role');
    if (role !== 'org_admin') return fail('not_org_admin');

    const orgId = await getUserOrganizationId();
    if (!orgId) return fail('no_org');

    let secretId: string;
    try {
      const admin = getSupabaseServerAdminClient();
      const { data, error } = await admin.rpc('groupme_store_token', {
        p_org_id: orgId,
        p_token: accessToken,
      });
      if (error || !data) throw error ?? new Error('no secret id');
      secretId = data;
    } catch (err) {
      logger.error({ ...ctx, err }, 'groupme callback: vault store failed');
      return fail('store_failed');
    }

    // Clean redirect to the group picker; carry only {orgId, secretId} forward.
    const res = NextResponse.redirect(new URL(SELECT_PATH, appConfig.url));
    res.cookies.set(GROUPME_PENDING_COOKIE, signPending({ orgId, secretId }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: GROUPME_COOKIE_MAX_AGE,
    });
    res.cookies.set(GROUPME_NONCE_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  },
  { auth: true },
);
