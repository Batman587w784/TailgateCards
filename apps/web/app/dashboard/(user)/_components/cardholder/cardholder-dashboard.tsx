import { headers } from 'next/headers';

import { JWTUserData } from '@kit/supabase/types';
import { If } from '@kit/ui/if';
import { PageBody } from '@kit/ui/page';

import { detectPlatform } from '~/activate/_lib/detect-platform';

import { CardholderDashboardData } from '../../_lib/server/cardholder-page.loader';
import { HomeLayoutPageHeader } from '../home-page-header';
import { ActiveDiscountsSection } from './active-discounts-section';
import { CardInfo, CardInfoEmpty } from './card-info';
import { CardStatusBadge } from './card-status-badge';
import { WalletWarningBanner } from './wallet-warning-banner';

interface CardholderDashboardProps {
  user: JWTUserData;
  data: CardholderDashboardData;
}

export async function CardholderDashboard({
  user,
  data,
}: CardholderDashboardProps) {
  const displayName =
    (user.user_metadata?.display_name as string) ||
    user.email?.split('@')[0] ||
    'Cardholder';

  const platform = detectPlatform((await headers()).get('user-agent'));

  const isExpired = data.card?.is_expired ?? false;
  const renewHref = data.card?.organization.slug
    ? `/activate/o/${data.card.organization.slug}`
    : null;

  const showWalletWarning =
    data.card != null &&
    !isExpired &&
    data.walletStatus.appleAddedAt == null &&
    data.walletStatus.googleAddedAt == null;

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader
        title={`Welcome back, ${displayName}`}
        description="Activity"
        trailing={<CardStatusBadge card={data.card} />}
      />

      <PageBody className="space-y-6">
        <If condition={showWalletWarning && data.card}>
          {(card) => (
            <WalletWarningBanner
              cardCode={card.display_code}
              platform={platform}
            />
          )}
        </If>

        {/* Header Section: Welcome + Card Info */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col justify-center py-4 md:col-span-2">
            <h2 className="text-brand text-3xl font-bold">
              Welcome, {displayName}!
            </h2>
            <p className="text-muted-foreground text-[20px]">
              Here&apos;s your Tailgate activity
            </p>
            <div className="mt-2 flex justify-end lg:hidden">
              <CardStatusBadge card={data.card} />
            </div>
          </div>
          <div>
            {data.card ? <CardInfo card={data.card} /> : <CardInfoEmpty />}
          </div>
        </div>

        {/* Active Discounts Section */}
        <ActiveDiscountsSection
          discounts={data.discounts.active}
          isExpired={isExpired}
          renewHref={renewHref}
        />
      </PageBody>
    </div>
  );
}
