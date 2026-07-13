'use client';

import { usePathname, useRouter } from 'next/navigation';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import {
  CardholderData,
  DistributorAccount,
  DistrictWithStats,
  MerchantOption,
  MerchantWithAccount,
  OrganizationOption,
  OrganizationWithAccount,
} from '../_lib/server/entities-page.loader';
import { CardholdersTab } from './cardholders-tab';
import { DistributorsTab } from './distributors-tab';
import { DistrictsTab } from './districts-tab';
import { MerchantsTab } from './merchants-tab';
import { OrganizationsTab } from './organizations-tab';

interface EntitiesTabsProps {
  organizations: {
    data: OrganizationWithAccount[];
    count: number;
    pageCount: number;
  };
  merchants: {
    data: MerchantWithAccount[];
    count: number;
    pageCount: number;
  };
  distributors: {
    data: DistributorAccount[];
    count: number;
    pageCount: number;
  };
  cardholders: {
    data: CardholderData[];
    count: number;
    pageCount: number;
  };
  districts: {
    data: DistrictWithStats[];
    count: number;
    pageCount: number;
  };
  organizationsForSelect: OrganizationOption[];
  merchantsForSelect: MerchantOption[];
  page: number;
  pageSize: number;
  query: string;
  activeTab: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function EntitiesTabs({
  organizations,
  merchants,
  distributors,
  cardholders,
  districts,
  organizationsForSelect,
  merchantsForSelect,
  page,
  pageSize,
  query,
  activeTab,
  sortBy,
  sortOrder,
}: EntitiesTabsProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', value);
    params.set('page', '1'); // Reset to page 1 when switching tabs
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-5">
        <TabsTrigger value="organizations" className="py-2">
          Organizations
        </TabsTrigger>
        <TabsTrigger value="districts" className="py-2">
          Districts
        </TabsTrigger>
        <TabsTrigger value="distributors" className="py-2">
          Distributors
        </TabsTrigger>
        <TabsTrigger value="merchants" className="py-2">
          Merchants
        </TabsTrigger>
        <TabsTrigger value="cardholders" className="py-2">
          Cardholders
        </TabsTrigger>
      </TabsList>

      <TabsContent value="organizations" className="mt-6">
        <OrganizationsTab
          data={organizations.data}
          pageCount={organizations.pageCount}
          pageSize={pageSize}
          page={page}
          query={query}
          totalCount={organizations.count}
          sortBy={sortBy}
          sortOrder={sortOrder}
          merchants={merchantsForSelect}
        />
      </TabsContent>

      <TabsContent value="districts" className="mt-6">
        <DistrictsTab
          data={districts.data}
          pageCount={districts.pageCount}
          pageSize={pageSize}
          page={page}
          query={query}
          totalCount={districts.count}
          sortBy={sortBy}
          sortOrder={sortOrder}
          organizations={organizationsForSelect}
        />
      </TabsContent>

      <TabsContent value="distributors" className="mt-6">
        <DistributorsTab
          data={distributors.data}
          pageCount={distributors.pageCount}
          pageSize={pageSize}
          page={page}
          query={query}
          totalCount={distributors.count}
          organizations={organizationsForSelect}
          merchants={merchantsForSelect}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </TabsContent>

      <TabsContent value="merchants" className="mt-6">
        <MerchantsTab
          data={merchants.data}
          pageCount={merchants.pageCount}
          pageSize={pageSize}
          page={page}
          query={query}
          totalCount={merchants.count}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </TabsContent>

      <TabsContent value="cardholders" className="mt-6">
        <CardholdersTab
          data={cardholders.data}
          pageCount={cardholders.pageCount}
          pageSize={pageSize}
          page={page}
          query={query}
          totalCount={cardholders.count}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </TabsContent>
    </Tabs>
  );
}
