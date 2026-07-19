import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { HomeLayoutPageHeader } from '../../_components/home-page-header';
import { LogoSettingsCard } from '../../_components/logo-settings-card';
import {
  getUserOrganizationId,
  requireOrgAdmin,
} from '../../_lib/server/role-guards';

export const metadata: Metadata = {
  title: 'Organization Settings',
  description: "Manage your organization's settings",
};

export default async function OrgAdminSettingsRoute() {
  await requireOrgAdmin();

  const orgId = await getUserOrganizationId();

  if (!orgId) {
    notFound();
  }

  const client = getSupabaseServerClient();
  const { data: org } = await client
    .from('accounts')
    .select('picture_url')
    .eq('id', orgId)
    .single();

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader
        title="Settings"
        description="Manage your organization"
      />

      <PageBody>
        <div className="max-w-2xl">
          <LogoSettingsCard
            kind="organization"
            entityId={orgId}
            currentLogoUrl={org?.picture_url ?? null}
          />
        </div>
      </PageBody>
    </div>
  );
}
