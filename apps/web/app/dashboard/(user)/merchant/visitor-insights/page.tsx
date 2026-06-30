import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { DashboardPageHeader } from '../../_components/dashboard-page-header';
import { HomeLayoutPageHeader } from '../../_components/home-page-header';
import { requireMerchant } from '../../_lib/server/role-guards';
import { loadVisitorInsights } from '../../_lib/server/visitor-insights.loader';
import { PasscodeGuard } from '../_components/passcode-guard';
import { VisitorInsightsDashboard } from './_components/visitor-insights-dashboard';

interface VisitorInsightsPageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('merchant:visitorInsights.title', {
    defaultValue: 'Visitor Insights',
  });

  return {
    title,
  };
};

async function VisitorInsightsPage({ searchParams }: VisitorInsightsPageProps) {
  await requireMerchant();

  const params = await searchParams;

  // Parse and validate date parameters
  const dateFrom = params.from ? new Date(params.from) : undefined;
  const dateTo = params.to ? new Date(params.to) : undefined;

  let validDateFrom =
    dateFrom && !isNaN(dateFrom.getTime()) ? dateFrom : undefined;
  let validDateTo = dateTo && !isNaN(dateTo.getTime()) ? dateTo : undefined;

  // Ensure dateFrom is not after dateTo
  if (validDateFrom && validDateTo && validDateFrom > validDateTo) {
    validDateFrom = undefined;
    validDateTo = undefined;
  }

  const data = await loadVisitorInsights({
    dateFrom: validDateFrom,
    dateTo: validDateTo,
  });

  return (
    <PasscodeGuard description="Enter your passcode to access visitor insights.">
      <div className="rounded-lg lg:m-4 lg:border">
        <HomeLayoutPageHeader
          title={<Trans i18nKey="merchant:visitorInsights.title" />}
          description="Visitor Insights"
        />

        <PageBody>
          <div className="flex flex-col gap-6 pt-4 md:pt-0">
            <DashboardPageHeader
              subtitle={data.merchant?.business_name ?? undefined}
              title={
                <Trans
                  i18nKey="merchant:visitorInsights.title"
                  defaults="Visitor Insights"
                />
              }
            />

            <VisitorInsightsDashboard data={data} />
          </div>
        </PageBody>
      </div>
    </PasscodeGuard>
  );
}

export default withI18n(VisitorInsightsPage);
