'use client';

import { useState } from 'react';

import { ArrowUpDown, QrCode, ScanSearch, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import type { MerchantDashboardData } from '../../_lib/server/merchant-page.loader';
import { DashboardPageHeader } from '../dashboard-page-header';
import { RedemptionsMobileList } from './redemptions-mobile-list';
import { RedemptionsTable } from './redemptions-table';
import { ScanCardSheet } from './scan-card-sheet';
import { SortDrawer } from './sort-drawer';

interface MerchantDashboardProps {
  data: MerchantDashboardData;
  searchParams: {
    page: number;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
}

export function MerchantDashboard({
  data,
  searchParams,
}: MerchantDashboardProps) {
  const [isScanSheetOpen, setIsScanSheetOpen] = useState(false);
  const [isSortDrawerOpen, setIsSortDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.search);

  const { merchant, redemptions } = data;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    if (searchValue) {
      params.set('search', searchValue);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    window.location.search = params.toString();
  };

  return (
    <>
      <PageHeader description={'Redemptions'} className="hidden md:block" />

      <PageBody>
        <div className="flex flex-col gap-6 pt-4 md:pt-0">
          {/* Big header inside page content */}
          <DashboardPageHeader
            subtitle={merchant?.business_name}
            title={
              <Trans
                i18nKey="merchant:redemptions.title"
                defaults="Redemptions"
              />
            }
          />

          {/* Mobile-only Scan a Card button */}
          <Button
            className="bg-brand-400 gap-2 text-base sm:hidden"
            onClick={() => setIsScanSheetOpen(true)}
          >
            <ScanSearch className="h-5 w-5" />
            <Trans i18nKey="merchant:actions.scanCard" defaults="Scan a Card" />
          </Button>

          {/* Mobile: Search and Sort controls */}
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setIsSortDrawerOpen(true)}
            >
              <ArrowUpDown className="h-4 w-4" />
              <Trans i18nKey="merchant:sort.sortBy" defaults="Sort by" />
            </Button>
          </div>

          {/* Mobile: Tile list */}
          <div className="sm:hidden">
            <RedemptionsMobileList
              data={redemptions.data}
              pageCount={redemptions.pageCount}
              currentPage={searchParams.page}
            />
          </div>

          {/* Desktop: Recent Scans Panel with Table */}
          <div
            className="hidden rounded-lg sm:block"
            style={{ boxShadow: '0px 1px 2px 0px #0000000D' }}
          >
            <Card>
              <CardHeader className="bg-muted rounded-t-lg p-3">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-muted-foreground">
                    <Trans
                      i18nKey="merchant:recentScans.title"
                      defaults="Recent Scans"
                    />
                  </CardTitle>

                  {/* Search and Scan button aligned right */}
                  <div className="flex items-center gap-2">
                    <form onSubmit={handleSearchSubmit}>
                      <div className="relative">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <Input
                          placeholder="Search"
                          value={searchValue}
                          onChange={(e) => setSearchValue(e.target.value)}
                          className="w-40 pl-10 sm:w-48"
                        />
                      </div>
                    </form>

                    {/* Scan button - disabled on desktop */}
                    <Button className="gap-2" disabled>
                      <QrCode className="h-4 w-4" />
                      <Trans
                        i18nKey="merchant:actions.scanCard"
                        defaults="Scan a Card"
                      />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* Table */}
                <RedemptionsTable
                  data={redemptions.data}
                  pageCount={redemptions.pageCount}
                  totalCount={redemptions.count}
                  currentPage={searchParams.page}
                  sortBy={searchParams.sortBy}
                  sortOrder={searchParams.sortOrder}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>

      {/* Scan Card Sheet */}
      <ScanCardSheet
        open={isScanSheetOpen}
        onOpenChange={setIsScanSheetOpen}
        merchantId={merchant?.id ?? ''}
      />

      {/* Sort Drawer */}
      <SortDrawer
        open={isSortDrawerOpen}
        onOpenChange={setIsSortDrawerOpen}
        currentSortOrder={searchParams.sortOrder}
      />
    </>
  );
}
