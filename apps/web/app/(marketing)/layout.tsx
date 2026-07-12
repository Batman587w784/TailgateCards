import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { HideOnHome } from '~/(marketing)/_components/hide-on-home';
import { SiteFooter } from '~/(marketing)/_components/site-footer';
import { SiteHeader } from '~/(marketing)/_components/site-header';
import { withI18n } from '~/lib/i18n/with-i18n';

async function SiteLayout(props: React.PropsWithChildren) {
  const client = getSupabaseServerClient();
  const user = await requireUser(client, { verifyMfa: false });

  return (
    <div className={'flex min-h-screen flex-col'}>
      {/* T0: the home route ('/') renders a minimal standalone screen, so the
          shared marketing chrome is hidden there but kept on every other page. */}
      <HideOnHome>
        <SiteHeader user={user.data} />
      </HideOnHome>

      {props.children}

      <HideOnHome>
        <SiteFooter />
      </HideOnHome>
    </div>
  );
}

export default withI18n(SiteLayout);
