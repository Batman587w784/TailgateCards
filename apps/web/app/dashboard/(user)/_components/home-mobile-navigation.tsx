'use client';

import Link from 'next/link';

import {
  BarChart3,
  CreditCard,
  HandHelping,
  LayoutDashboard,
  LogOut,
  Settings,
  TicketPercent,
  Users,
  Wallet,
  WalletCards,
} from 'lucide-react';

import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { If } from '@kit/ui/if';
import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';

// home imports
import type { UserWorkspace } from '../_lib/server/load-user-workspace';

export function HomeMobileNavigation(props: { workspace: UserWorkspace }) {
  const signOut = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Open menu">
          <Settings className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent sideOffset={10} className={'w-screen rounded-none'}>
        {/* Merchant menu: Redemptions, Visitor Insights, Account Settings */}
        {props.workspace.platformRole === 'merchant' ? (
          <>
            <DropdownMenuGroup>
              <DropdownLink
                path="/dashboard"
                label="merchant:nav.redemptions"
                Icon={<HandHelping className="h-6" />}
              />
              <DropdownLink
                path="/dashboard/merchant/visitor-insights"
                label="merchant:nav.visitorInsights"
                Icon={<BarChart3 className="h-6" />}
              />
              <DropdownLink
                path={pathsConfig.app.cardholderAccountSettings}
                label="common:routes.accountSettings"
                Icon={<Settings className="h-6" />}
              />
            </DropdownMenuGroup>
          </>
        ) : (
          <>
            {/* Non-merchant: default nav */}
            <DropdownMenuGroup>
              <DropdownLink
                path={pathsConfig.app.home}
                label="common:routes.dashboard"
                Icon={<LayoutDashboard className="h-6" />}
              />
            </DropdownMenuGroup>

            <If condition={props.workspace.isSuperAdmin}>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownLink
                  path="/dashboard/entities"
                  label="common:routes.users"
                  Icon={<Users className="h-6" />}
                />
                <DropdownLink
                  path="/dashboard/discounts"
                  label="common:routes.discounts"
                  Icon={<TicketPercent className="h-6" />}
                />
                <DropdownLink
                  path="/dashboard/payments"
                  label="common:routes.payments"
                  Icon={<WalletCards className="h-6" />}
                />
                <DropdownLink
                  path="/dashboard/cards"
                  label="common:routes.cards"
                  Icon={<Wallet className="h-6" />}
                />
              </DropdownMenuGroup>
            </If>

            <If condition={props.workspace.platformRole === 'org_admin'}>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownLink
                  path="/dashboard/org-admin/distributors"
                  label="common:routes.distributors"
                  Icon={<Users className="h-6" />}
                />
                <DropdownLink
                  path="/dashboard/org-admin/cards"
                  label="common:routes.cards"
                  Icon={<CreditCard className="h-6" />}
                />
              </DropdownMenuGroup>
            </If>

            <If condition={props.workspace.platformRole === 'distributor'}>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownLink
                  path="/dashboard/distributor/cards"
                  label="Cards"
                  Icon={<CreditCard className="h-6" />}
                />
              </DropdownMenuGroup>
            </If>

            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownLink
                path={pathsConfig.app.cardholderAccountSettings}
                label="common:routes.accountSettings"
                Icon={<Settings className="h-6" />}
              />
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />

        <SignOutDropdownItem onSignOut={() => signOut.mutateAsync()} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownLink(
  props: React.PropsWithChildren<{
    path: string;
    label: string;
    Icon: React.ReactNode;
  }>,
) {
  return (
    <DropdownMenuItem asChild key={props.path}>
      <Link
        href={props.path}
        className={'flex h-12 w-full items-center space-x-4'}
      >
        {props.Icon}

        <span>
          <Trans i18nKey={props.label} defaults={props.label} />
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

function SignOutDropdownItem(
  props: React.PropsWithChildren<{
    onSignOut: () => unknown;
  }>,
) {
  return (
    <DropdownMenuItem
      className={'flex h-12 w-full items-center space-x-4'}
      onClick={props.onSignOut}
    >
      <LogOut className={'h-6'} />

      <span>
        <Trans i18nKey={'common:signOut'} defaults={'Sign out'} />
      </span>
    </DropdownMenuItem>
  );
}
