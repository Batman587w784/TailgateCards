import { cache } from 'react';

import { notFound } from 'next/navigation';

import { isSuperAdmin } from '@kit/admin';
import { AdminAccountPage } from '@kit/admin/components/admin-account-page';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

export const generateMetadata = async (props: Params) => {
  const params = await props.params;
  const account = await loadAccount(params.id);

  return {
    title: `${account.name} | Account`,
  };
};

export default async function AccountPage(props: Params) {
  const client = getSupabaseServerClient();
  const isAdmin = await isSuperAdmin(client);

  if (!isAdmin) {
    notFound();
  }

  const params = await props.params;
  const account = await loadAccount(params.id);

  return <AdminAccountPage account={account} />;
}

const loadAccount = cache(accountLoader);

async function accountLoader(id: string) {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('accounts')
    .select('*, memberships: accounts_memberships (*)')
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
