import { NextRequest, NextResponse } from 'next/server';

import { getLogger } from '@kit/shared/logger';
import { createAuthCallbackService } from '@kit/supabase/auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

export async function GET(request: NextRequest) {
  const client = getSupabaseServerClient();
  const service = createAuthCallbackService(client);

  const url = await service.verifyTokenHash(request, {
    joinTeamPath: pathsConfig.app.joinTeam,
    redirectPath: pathsConfig.app.home,
  });

  const type = request.nextUrl.searchParams.get('type');

  if (type === 'email') {
    try {
      const {
        data: { user },
      } = await client.auth.getUser();

      if (user?.email) {
        const { sendWelcomeEmail } =
          await import('~/lib/server/welcome-email.service');

        await sendWelcomeEmail({ email: user.email });
      }
    } catch (error) {
      const logger = await getLogger();
      logger.error(
        { name: 'auth.confirm', error },
        'Failed to send welcome email',
      );
    }
  }

  return NextResponse.redirect(url);
}
