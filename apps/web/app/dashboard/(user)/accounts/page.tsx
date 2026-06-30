import { notFound } from 'next/navigation';

import { ServerDataLoader } from '@makerkit/data-loader-supabase-nextjs';

import { isSuperAdmin } from '@kit/admin';
import { AdminAccountsTable } from '@kit/admin/components/admin-accounts-table';
import { AdminCreateUserDialog } from '@kit/admin/components/admin-create-user-dialog';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import { PageBody } from '@kit/ui/page';

import { DashboardPageHeader } from '../_components/dashboard-page-header';
import { HomeLayoutPageHeader } from '../_components/home-page-header';

interface SearchParams {
  page?: string;
  account_type?: 'all' | 'team' | 'personal';
  query?: string;
}

interface AdminAccountsPageProps {
  searchParams: Promise<SearchParams>;
}

export const metadata = {
  title: `Accounts`,
};

export default async function AccountsPage(props: AdminAccountsPageProps) {
  const client = getSupabaseServerClient();
  const isAdmin = await isSuperAdmin(client);

  if (!isAdmin) {
    notFound();
  }

  const searchParams = await props.searchParams;
  const page = searchParams.page ? parseInt(searchParams.page) : 1;

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader title="Accounts" description="Accounts">
        <div className="flex justify-end">
          <AdminCreateUserDialog>
            <Button data-test="admin-create-user-button">Create User</Button>
          </AdminCreateUserDialog>
        </div>
      </HomeLayoutPageHeader>

      <PageBody>
        <DashboardPageHeader title="Accounts" className="mb-6" />
        <ServerDataLoader
          table={'accounts'}
          client={client}
          page={page}
          where={(queryBuilder) => {
            const { account_type: type, query } = searchParams;

            if (type && type !== 'all') {
              queryBuilder.eq('is_personal_account', type === 'personal');
            }

            if (query) {
              queryBuilder.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
            }

            return queryBuilder;
          }}
        >
          {({ data, page, pageSize, pageCount }) => {
            return (
              <AdminAccountsTable
                page={page}
                pageSize={pageSize}
                pageCount={pageCount}
                data={data}
                filters={{
                  type: searchParams.account_type ?? 'all',
                  query: searchParams.query ?? '',
                }}
              />
            );
          }}
        </ServerDataLoader>
      </PageBody>
    </div>
  );
}
