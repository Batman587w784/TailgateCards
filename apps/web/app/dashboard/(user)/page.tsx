import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

// local imports
import { CardholderDashboard } from './_components/cardholder/cardholder-dashboard';
import { DistrictAdminDashboard } from './_components/district-admin/district-admin-dashboard';
import { DistributorDashboard } from './_components/distributor/distributor-dashboard';
import { HomeLayoutPageHeader } from './_components/home-page-header';
import { MerchantDashboard } from './_components/merchant/merchant-dashboard';
import { OrgAdminDashboard } from './_components/org-admin/org-admin-dashboard';
import { SuperAdminDashboard } from './_components/super-admin-dashboard';
import { UserDetailsCard } from './_components/user-details-card';
import { loadCardholderDashboard } from './_lib/server/cardholder-page.loader';
import { loadDistrictDashboard } from './_lib/server/district-dashboard.loader';
import { loadDistributorDashboard } from './_lib/server/distributor-dashboard.loader';
import { loadUserWorkspace } from './_lib/server/load-user-workspace';
import { loadMerchantDashboard } from './_lib/server/merchant-page.loader';
import { loadOrgAdminDashboard } from './_lib/server/org-admin-dashboard.loader';
import { loadSuperAdminDashboard } from './_lib/server/super-admin-dashboard.loader';

interface UserHomePageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    // Super admin dashboard filters
    org?: string;
    from?: string;
    to?: string;
    // Org admin dashboard filters
    distributors?: string;
  }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('account:homePage');

  return {
    title,
  };
};

async function UserHomePage({ searchParams }: UserHomePageProps) {
  const [params, { user, platformRole, isSuperAdmin }] = await Promise.all([
    searchParams,
    loadUserWorkspace(),
  ]);

  const page = params.page ? parseInt(params.page, 10) : 1;
  const search = params.search ?? '';
  const sortBy = params.sortBy ?? 'redeemed_at';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') ?? 'desc';

  // Super admins get the admin dashboard, not cardholder dashboard
  // (even if their personal account has platform_role = 'cardholder')
  if (isSuperAdmin) {
    const dashboardData = await loadSuperAdminDashboard({
      page,
      organizationId: params.org,
      dateFrom: params.from ? new Date(params.from) : undefined,
      dateTo: params.to ? new Date(params.to) : undefined,
    });

    return (
      <div className="rounded-lg lg:m-4 lg:border">
        <HomeLayoutPageHeader
          title={<Trans i18nKey={'common:routes.home'} />}
          description={<Trans i18nKey={'common:homeTabDescription'} />}
        />

        <PageBody>
          <SuperAdminDashboard data={dashboardData} />
        </PageBody>
      </div>
    );
  }

  // Show cardholder dashboard for cardholders (who have cards)
  if (platformRole === 'cardholder') {
    const cardholderData = await loadCardholderDashboard();
    return <CardholderDashboard user={user} data={cardholderData} />;
  }

  // Show merchant dashboard for merchants
  if (platformRole === 'merchant') {
    const merchantData = await loadMerchantDashboard({
      page,
      search,
      sortBy,
      sortOrder,
    });
    return (
      <MerchantDashboard
        data={merchantData}
        searchParams={{ page, search, sortBy, sortOrder }}
      />
    );
  }

  // Show district (campus) admin dashboard for district_admin
  if (platformRole === 'district_admin') {
    const districtData = await loadDistrictDashboard();
    return (
      <div className="rounded-lg lg:m-4 lg:border">
        <HomeLayoutPageHeader
          title={<Trans i18nKey={'common:routes.home'} />}
          description={<Trans i18nKey={'common:homeTabDescription'} />}
        />

        <PageBody>
          <DistrictAdminDashboard data={districtData} />
        </PageBody>
      </div>
    );
  }

  // Show organization admin dashboard for org_admin
  if (platformRole === 'org_admin') {
    const orgAdminData = await loadOrgAdminDashboard({
      dateFrom: params.from ?? undefined,
      dateTo: params.to ?? undefined,
      distributorIds: params.distributors?.split(',').filter(Boolean),
    });
    return (
      <div className="rounded-lg lg:m-4 lg:border">
        <HomeLayoutPageHeader
          title={<Trans i18nKey={'common:routes.home'} />}
          description={<Trans i18nKey={'common:homeTabDescription'} />}
        />

        <PageBody>
          <OrgAdminDashboard data={orgAdminData} />
        </PageBody>
      </div>
    );
  }

  // Show distributor dashboard for distributors
  if (platformRole === 'distributor') {
    const distributorData = await loadDistributorDashboard({
      dateFrom: params.from ?? undefined,
      dateTo: params.to ?? undefined,
    });
    return (
      <div className="rounded-lg lg:m-4 lg:border">
        <HomeLayoutPageHeader
          title={<Trans i18nKey={'common:routes.home'} />}
          description={<Trans i18nKey={'common:homeTabDescription'} />}
        />

        <PageBody>
          <DistributorDashboard data={distributorData} />
        </PageBody>
      </div>
    );
  }

  // Default dashboard for other roles
  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader
        title={<Trans i18nKey={'common:routes.home'} />}
        description={<Trans i18nKey={'common:homeTabDescription'} />}
      />

      <PageBody>
        <div className="mx-auto max-w-md">
          <UserDetailsCard
            email={user.email}
            userId={user.id}
            platformRole={platformRole}
            isSuperAdmin={isSuperAdmin}
          />
        </div>
      </PageBody>
    </div>
  );
}

export default withI18n(UserHomePage);
