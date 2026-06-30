'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LayoutDashboard, Settings } from 'lucide-react';

import { If } from '@kit/ui/if';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@kit/ui/shadcn-sidebar';
import { Trans } from '@kit/ui/trans';

import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import pathsConfig from '~/config/paths.config';
import { personalAccountNavigationConfig } from '~/config/personal-account-navigation.config';

// home imports
import type { UserWorkspace } from '../_lib/server/load-user-workspace';
import { AdminNavigation } from './admin-navigation';
import { DistributorNavigation } from './distributor-navigation';
import { DistributorShareLinkCard } from './distributor/distributor-share-link-card';
import { MerchantNavigation } from './merchant-navigation';
import { OrgAdminNavigation } from './org-admin-navigation';
import { OrgShareLinkCard } from './org-admin/org-share-link-card';

interface HomeSidebarProps {
  workspace: UserWorkspace;
}

export function HomeSidebar(props: HomeSidebarProps) {
  const { workspace, user } = props.workspace;
  const collapsible = personalAccountNavigationConfig.sidebarCollapsedStyle;

  return (
    <Sidebar collapsible={collapsible}>
      <SidebarHeader className="flex items-center justify-center p-4">
        <AppLogo className="h-8 w-auto" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dashboard for non-merchants */}
              <If condition={props.workspace.platformRole !== 'merchant'}>
                <DashboardMenuItem />
              </If>

              <If condition={props.workspace.isSuperAdmin}>
                <AdminNavigation />
              </If>

              <If condition={props.workspace.platformRole === 'org_admin'}>
                <OrgAdminNavigation />
              </If>

              <If condition={props.workspace.platformRole === 'merchant'}>
                <MerchantNavigation />
              </If>

              <If condition={props.workspace.platformRole === 'distributor'}>
                <DistributorNavigation />
              </If>

              <AccountSettingsMenuItem />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <If condition={props.workspace.platformRole === 'distributor'}>
          <DistributorShareLinkCard
            shareSlug={props.workspace.distributorShareSlug}
            className="group-data-[collapsible=icon]:hidden"
          />
        </If>
        <If condition={props.workspace.platformRole === 'org_admin'}>
          <OrgShareLinkCard
            shareSlug={props.workspace.orgShareSlug}
            className="group-data-[collapsible=icon]:hidden"
          />
        </If>
        <ProfileAccountDropdownContainer
          user={user}
          account={workspace ?? undefined}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

function DashboardMenuItem() {
  const path = usePathname();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={path === pathsConfig.app.home} asChild>
        <Link className="flex size-full gap-2.5" href={pathsConfig.app.home}>
          <LayoutDashboard className="h-4" />
          <Trans i18nKey="common:routes.dashboard" />
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AccountSettingsMenuItem() {
  const path = usePathname();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={path.includes('/dashboard/account-settings')}
        asChild
      >
        <Link
          className="flex size-full gap-2.5"
          href={pathsConfig.app.cardholderAccountSettings}
        >
          <Settings className="h-4" />
          <Trans i18nKey="common:routes.accountSettings" />
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
