'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { format } from 'date-fns';
import {
  Activity,
  AreaChart,
  ArrowLeftRight,
  ChevronDown,
  CreditCard,
  Filter,
  Rocket,
  TicketCheck,
  UserSearch,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Calendar as CalendarPicker } from '@kit/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Separator } from '@kit/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import {
  DashboardAreaChart,
  RankingTable,
  StatCard,
} from '~/_components/dashboard';

import type { SuperAdminDashboardData } from '../_lib/server/super-admin-dashboard.loader';
import { CardUsageDonutChart } from './card-usage-donut-chart';
import { DashboardPageHeader } from './dashboard-page-header';

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

interface SuperAdminDashboardProps {
  data: SuperAdminDashboardData;
}

export function SuperAdminDashboard({ data }: SuperAdminDashboardProps) {
  const {
    cardStats,
    transactionStats,
    platformStats,
    revenueData,
    cardUsageDistribution,
    cardsActivatedByOrg,
    topOrganizations,
    recentActivations,
    activationPagination,
    organizations,
    cardTypeSplit,
  } = data;

  const router = useRouter();
  const searchParams = useSearchParams();

  const recentActivationsRef = useRef<HTMLDivElement>(null);
  const paginationClicked = useRef(false);

  useEffect(() => {
    if (paginationClicked.current) {
      paginationClicked.current = false;
      recentActivationsRef.current?.scrollIntoView({
        block: 'start',
        behavior: 'instant',
      });
    }
  }, [activationPagination.page]);

  // Get current filter values from URL
  const selectedOrg = searchParams.get('org') || 'all';
  const dateFrom = searchParams.get('from');
  const dateTo = searchParams.get('to');

  const dateRange: DateRange | undefined = useMemo(() => {
    if (!dateFrom) return undefined;
    return {
      from: new Date(dateFrom),
      to: dateTo ? new Date(dateTo) : undefined,
    };
  }, [dateFrom, dateTo]);

  // Handle organization filter change
  const handleOrgChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('org');
    } else {
      params.set('org', value);
    }
    params.delete('page'); // Reset to page 1 when filtering
    router.push(`?${params.toString()}`);
  };

  // Handle date range change
  const handleDateRangeChange = (range: DateRange | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (range?.from) {
      // TypeScript narrowing: we know from is defined here
      const fromDate: Date = range.from;
      // Format in local time to avoid timezone issues
      const fromStr = format(fromDate, 'yyyy-MM-dd');
      if (fromStr) params.set('from', fromStr);

      if (range.to) {
        const toDate: Date = range.to;
        const toStr = format(toDate, 'yyyy-MM-dd');
        if (toStr) params.set('to', toStr);
      } else {
        params.delete('to');
      }
    } else {
      params.delete('from');
      params.delete('to');
    }
    params.delete('page'); // Reset to page 1 when filtering
    router.push(`?${params.toString()}`);
  };

  // Handle pagination
  const handlePageChange = useCallback(
    (newPage: number) => {
      paginationClicked.current = true;
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(newPage));
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Format revenue data for chart (convert cents to dollars)
  const chartData = revenueData.map((d) => ({
    name: d.month,
    revenue: d.revenue / 100,
  }));

  // Prepare card usage donut chart data with specific colors
  const cardUsageSegments = [
    {
      name: 'No usage yet',
      value: cardUsageDistribution.no_usage,
      color: '#2A9D90',
    },
    {
      name: 'Used 1 time',
      value: cardUsageDistribution.used_1_time,
      color: '#E76E50',
    },
    {
      name: 'Used 2 times',
      value: cardUsageDistribution.used_2_times,
      color: '#274754',
    },
    {
      name: 'Used 3 times',
      value: cardUsageDistribution.used_3_times,
      color: '#E8C468',
    },
    {
      name: 'Used 4+ times',
      value: cardUsageDistribution.used_4_plus_times,
      color: '#F4A462',
    },
  ];

  // Calculate totals for Cards Activated table
  const cardsActivatedTotals = useMemo(() => {
    const totals = cardsActivatedByOrg.reduce(
      (acc, org) => ({
        activated: acc.activated + org.activated_count,
        inactive: acc.inactive + org.inactive_count,
      }),
      { activated: 0, inactive: 0 },
    );
    return totals;
  }, [cardsActivatedByOrg]);

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Dashboard" />

      {/* Stats Row */}
      {/* Mobile: Horizontal scroll, 1 card visible */}
      <div
        role="region"
        aria-label="Dashboard statistics"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
      >
        <div className="min-w-[85%] flex-shrink-0 snap-start">
          <StatCard
            icon={CreditCard}
            title="Cards"
            stats={[
              {
                label: 'Active Cards',
                value: cardStats.active_cards,
                format: 'number',
                subStats: [
                  {
                    label: 'Physical Cards',
                    value: cardTypeSplit.physical_activated,
                    format: 'number',
                  },
                  {
                    label: 'Digital Cards',
                    value: cardTypeSplit.digital_activated,
                    format: 'number',
                  },
                ],
              },
              {
                label: 'Inactive Cards',
                value: cardStats.inactive_cards,
                format: 'number',
                subStats: [
                  {
                    label: 'Physical Cards',
                    value: Math.max(
                      0,
                      cardTypeSplit.physical_total -
                        cardTypeSplit.physical_activated,
                    ),
                    format: 'number',
                  },
                  {
                    label: 'Digital Cards',
                    value: Math.max(
                      0,
                      cardTypeSplit.digital_total -
                        cardTypeSplit.digital_activated,
                    ),
                    format: 'number',
                  },
                ],
              },
              {
                label: 'Used at least 1 time (%)',
                value: cardStats.usage_percentage,
                format: 'percent',
              },
            ]}
          />
        </div>
        <div className="min-w-[85%] flex-shrink-0 snap-start">
          <StatCard
            icon={ArrowLeftRight}
            title="Transactions"
            stats={[
              {
                label: 'Total Revenue Generated',
                value: transactionStats.total_revenue_cents,
                format: 'currency',
              },
              {
                label: 'Failed Transactions',
                value: transactionStats.failed_transactions,
                format: 'number',
              },
            ]}
          />
        </div>
        <div className="min-w-[85%] flex-shrink-0 snap-start">
          <StatCard
            icon={UserSearch}
            title="Platform Usage"
            stats={[
              {
                label: 'Active Organizations',
                value: platformStats.active_organizations,
                format: 'number',
              },
              {
                label: 'Active Merchants',
                value: platformStats.active_merchants,
                format: 'number',
              },
              {
                label: 'Total Cardholders',
                value: platformStats.total_cardholders,
                format: 'number',
              },
            ]}
          />
        </div>
      </div>

      {/* Desktop: Grid layout */}
      <div className="hidden gap-4 md:grid md:grid-cols-3">
        <StatCard
          icon={CreditCard}
          title="Cards"
          stats={[
            {
              label: 'Active Cards',
              value: cardStats.active_cards,
              format: 'number',
              subStats: [
                {
                  label: 'Physical Cards',
                  value: cardTypeSplit.physical_activated,
                  format: 'number',
                },
                {
                  label: 'Digital Cards',
                  value: cardTypeSplit.digital_activated,
                  format: 'number',
                },
              ],
            },
            {
              label: 'Inactive Cards',
              value: cardStats.inactive_cards,
              format: 'number',
              subStats: [
                {
                  label: 'Physical Cards',
                  value: Math.max(
                    0,
                    cardTypeSplit.physical_total -
                      cardTypeSplit.physical_activated,
                  ),
                  format: 'number',
                },
                {
                  label: 'Digital Cards',
                  value: Math.max(
                    0,
                    cardTypeSplit.digital_total -
                      cardTypeSplit.digital_activated,
                  ),
                  format: 'number',
                },
              ],
            },
            {
              label: 'Used at least 1 time (%)',
              value: cardStats.usage_percentage,
              format: 'percent',
            },
          ]}
        />
        <StatCard
          icon={ArrowLeftRight}
          title="Transactions"
          stats={[
            {
              label: 'Total Revenue Generated',
              value: transactionStats.total_revenue_cents,
              format: 'currency',
            },
            {
              label: 'Failed Transactions',
              value: transactionStats.failed_transactions,
              format: 'number',
            },
          ]}
        />
        <StatCard
          icon={UserSearch}
          title="Platform Usage"
          stats={[
            {
              label: 'Active Organizations',
              value: platformStats.active_organizations,
              format: 'number',
            },
            {
              label: 'Active Merchants',
              value: platformStats.active_merchants,
              format: 'number',
            },
            {
              label: 'Total Cardholders',
              value: platformStats.total_cardholders,
              format: 'number',
            },
          ]}
        />
      </div>

      {/* Filters Row */}
      <div className="flex justify-end gap-3">
        <Select value={selectedOrg} onValueChange={handleOrgChange}>
          <SelectTrigger className="bg-background w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Organization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organizations</SelectItem>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <span className="truncate">
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'MMM d')} -{' '}
                      {format(dateRange.to, 'MMM d')}
                    </>
                  ) : (
                    format(dateRange.from, 'MMM d, yyyy')
                  )
                ) : (
                  'Date range'
                )}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarPicker
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateRangeChange}
              numberOfMonths={1}
            />
            {dateRange && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDateRangeChange(undefined)}
                >
                  Clear
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardAreaChart
          title="Revenue Over Time"
          icon={AreaChart}
          data={chartData}
          series={[
            {
              dataKey: 'revenue',
              label: 'Revenue',
              color: '#095BB4',
              stroke: '#095BB4',
              gradientFrom: '#095BB4',
              gradientTo: '#F2F8FF',
            },
          ]}
          xAxisKey="name"
          formatYAxis={(value: number) =>
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value)
          }
        />
        <CardUsageDonutChart segments={cardUsageSegments} />
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Cards Activated Table */}
        <div
          className="rounded-lg"
          style={{ boxShadow: '0px 1px 2px 0px #0000000D' }}
        >
          <Card>
            <CardHeader className="bg-muted flex flex-row items-center gap-3 rounded-t-lg p-3">
              <TicketCheck className="text-muted-foreground h-4 w-4" />
              <CardTitle className="text-muted-foreground text-base font-medium">
                Cards Activated
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-4 pl-4">Organization</TableHead>
                    <TableHead className="text-right">Activated</TableHead>
                    <TableHead className="pr-4 text-right">Inactive</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cardsActivatedByOrg.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-muted-foreground h-24 text-center"
                      >
                        No organizations yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {cardsActivatedByOrg.map((org) => (
                        <TableRow key={org.organization_id}>
                          <TableCell className="py-4 pl-4 font-medium">
                            {org.organization_name}
                          </TableCell>
                          <TableCell className="py-4 text-right">
                            {org.activated_count.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-4 pr-4 text-right">
                            {org.inactive_count.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell className="py-4 pl-4">Total</TableCell>
                        <TableCell className="py-4 text-right">
                          {cardsActivatedTotals.activated.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-4 pr-4 text-right">
                          {cardsActivatedTotals.inactive.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Top Performing Organizations */}
        <RankingTable
          title="Top Performing Organizations"
          icon={Rocket}
          columns={[
            { key: 'name', label: 'Organization' },
            {
              key: 'total_revenue',
              label: 'Total Revenue',
              format: 'currency',
              align: 'right',
            },
          ]}
          data={topOrganizations}
          emptyMessage="No organizations yet"
        />
      </div>

      {/* Recent Activations */}
      <div
        ref={recentActivationsRef}
        className="rounded-lg"
        style={{ boxShadow: '0px 1px 2px 0px #0000000D' }}
      >
        <Card>
          <CardHeader className="bg-muted flex flex-row items-center gap-3 rounded-t-lg p-3">
            <Activity className="text-muted-foreground h-4 w-4" />
            <CardTitle className="text-muted-foreground text-base font-medium">
              Recent Activations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivations.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-sm">
                No recent activations
              </p>
            ) : (
              <div className="divide-y">
                {recentActivations.map((activation) => (
                  <div
                    key={activation.id}
                    className="flex items-start justify-between px-6 py-4"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-primary font-medium">
                        {activation.cardholder_name || 'Unknown User'}
                      </span>
                      <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Card ID: {activation.display_code}</span>
                      </div>
                      <span className="text-sm">
                        {activation.organization_name}
                      </span>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-sm">
                      {format(
                        new Date(activation.activated_at),
                        'MMM d, yyyy HH:mm',
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activationPagination.totalPages > 1 && (
              <>
                <Separator />
                <div className="flex items-center justify-end gap-2 p-4">
                  {(() => {
                    const pages: React.ReactNode[] = [];
                    const { page: currentPage, totalPages } =
                      activationPagination;

                    // Show first page if not in window
                    if (currentPage > 3) {
                      pages.push(
                        <Button
                          key={1}
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePageChange(1)}
                        >
                          1
                        </Button>,
                      );
                      if (currentPage > 4) {
                        pages.push(
                          <span
                            key="ellipsis-1"
                            className="text-muted-foreground px-1"
                          >
                            ...
                          </span>,
                        );
                      }
                    }

                    // Show pages around current page
                    const start = Math.max(1, currentPage - 2);
                    const end = Math.min(totalPages, currentPage + 2);

                    for (let i = start; i <= end; i++) {
                      pages.push(
                        <Button
                          key={i}
                          variant={currentPage === i ? 'outline' : 'ghost'}
                          size="sm"
                          className={
                            currentPage === i
                              ? 'border-primary text-primary'
                              : ''
                          }
                          onClick={() => handlePageChange(i)}
                        >
                          {i}
                        </Button>,
                      );
                    }

                    // Show last page if not in window
                    if (currentPage < totalPages - 2) {
                      if (currentPage < totalPages - 3) {
                        pages.push(
                          <span
                            key="ellipsis-2"
                            className="text-muted-foreground px-1"
                          >
                            ...
                          </span>,
                        );
                      }
                      pages.push(
                        <Button
                          key={totalPages}
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePageChange(totalPages)}
                        >
                          {totalPages}
                        </Button>,
                      );
                    }

                    return pages;
                  })()}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
