import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';

import { JWTUserData } from '@kit/supabase/types';
import { Button } from '@kit/ui/button';
import { Header } from '@kit/ui/marketing';

import { MobileHeader } from '~/components/mobile-header';
import { TailgateLogo } from '~/components/tailgate-logo';
import pathsConfig from '~/config/paths.config';

import { SiteHeaderAccountSection } from './site-header-account-section';

export function SiteHeader(props: { user?: JWTUserData | null }) {
  const rightContent = props.user ? (
    <SiteHeaderAccountSection user={props.user} />
  ) : (
    <div className="flex items-center gap-x-2">
      <Button asChild variant="outline" size="sm">
        <Link href={pathsConfig.auth.signIn}>Sign In</Link>
      </Button>
      <Button
        asChild
        size="sm"
        className="bg-brand hover:bg-brand/90"
        style={{ boxShadow: '4px 4px 8px 0px rgba(0, 4, 86, 0.4)' }}
      >
        <Link href="/activate">
          Activate My Card
          <ArrowUpRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <MobileHeader left="logo" right={rightContent} />

      {/* Desktop Header */}
      <div className="hidden lg:block">
        <Header
          logo={<TailgateLogo />}
          navigation={null}
          actions={rightContent}
        />
      </div>
    </>
  );
}
