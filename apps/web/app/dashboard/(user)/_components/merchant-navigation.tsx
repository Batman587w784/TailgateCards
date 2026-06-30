'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BarChart3, HandHelping } from 'lucide-react';

import { SidebarMenuButton, SidebarMenuItem } from '@kit/ui/shadcn-sidebar';
import { Trans } from '@kit/ui/trans';

export function MerchantNavigation() {
  const path = usePathname();

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={path === '/dashboard' || path === '/dashboard/'}
          asChild
        >
          <Link className="flex size-full gap-2.5" href="/dashboard">
            <HandHelping className="h-4" />
            <Trans i18nKey="merchant:nav.redemptions" defaults="Redemptions" />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={path.includes('/dashboard/merchant/visitor-insights')}
          asChild
        >
          <Link
            className="flex size-full gap-2.5"
            href="/dashboard/merchant/visitor-insights"
          >
            <BarChart3 className="h-4" />
            <Trans
              i18nKey="merchant:nav.visitorInsights"
              defaults="Visitor Insights"
            />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  );
}
