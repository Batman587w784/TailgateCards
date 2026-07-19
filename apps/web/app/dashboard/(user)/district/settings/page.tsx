import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { HomeLayoutPageHeader } from '../../_components/home-page-header';
import { LogoSettingsCard } from '../../_components/logo-settings-card';
import {
  getUserDistrictId,
  requireDistrictAdmin,
} from '../../_lib/server/role-guards';

export const metadata: Metadata = {
  title: 'District Settings',
  description: "Manage your district's settings",
};

export default async function DistrictSettingsRoute() {
  await requireDistrictAdmin();

  const districtId = await getUserDistrictId();

  if (!districtId) {
    notFound();
  }

  const client = getSupabaseServerClient();
  const { data: district } = await client
    .from('districts')
    .select('logo_url')
    .eq('id', districtId)
    .single();

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader
        title="Settings"
        description="Manage your district"
      />

      <PageBody>
        <div className="max-w-2xl">
          <LogoSettingsCard
            kind="district"
            entityId={districtId}
            currentLogoUrl={district?.logo_url ?? null}
          />
        </div>
      </PageBody>
    </div>
  );
}
