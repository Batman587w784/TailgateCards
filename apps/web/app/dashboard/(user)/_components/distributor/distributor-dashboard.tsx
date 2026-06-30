'use client';

import { useMemo, useState } from 'react';

import { format } from 'date-fns';
import {
  Activity,
  CalendarIcon,
  CircleDollarSign,
  Clock,
  PieChart as PieChartIcon,
  TrendingUp,
  Users,
  Wallet,
  createLucideIcon,
} from 'lucide-react';
import { Cell, Label, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { Button } from '@kit/ui/button';
import { Calendar } from '@kit/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@kit/ui/chart';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { cn } from '@kit/ui/utils';

import { DashboardAreaChart, SimpleStatCard } from '~/_components/dashboard';

import { useDashboardFilters } from '../../_lib/hooks/use-dashboard-filters';
import type {
  DistributorDashboardData,
  DistributorTopRanking,
} from '../../_lib/server/distributor-dashboard.loader';
import { DashboardPageHeader } from '../dashboard-page-header';
import { DistributorShareLinkCard } from './distributor-share-link-card';

interface DistributorDashboardProps {
  data: DistributorDashboardData;
}

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDateFull(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateString));
}

const distributionChartConfig: ChartConfig = {
  Sold: {
    label: 'Sold',
    color: 'var(--brand)',
  },
  Remaining: {
    label: 'Remaining',
    color: 'var(--color-gray-200)',
  },
};

const CreditCardX = createLucideIcon('credit-card-x', [
  [
    'rect',
    { width: '20', height: '14', x: '2', y: '5', rx: '2', key: 'ccx-rect' },
  ],
  ['line', { x1: '2', x2: '22', y1: '10', y2: '10', key: 'ccx-line' }],
  ['line', { x1: '15', y1: '13', x2: '19', y2: '17', key: 'ccx-x1' }],
  ['line', { x1: '19', y1: '13', x2: '15', y2: '17', key: 'ccx-x2' }],
]);

const CreditCardCheck = createLucideIcon('credit-card-check', [
  [
    'rect',
    { width: '20', height: '14', x: '2', y: '5', rx: '2', key: 'ccc-rect' },
  ],
  ['line', { x1: '2', x2: '22', y1: '10', y2: '10', key: 'ccc-line' }],
  ['path', { d: 'm14 15 2 2 4-4', key: 'ccc-check' }],
]);

interface DateRangeFilterProps {
  dateFrom: string | null;
  dateTo: string | null;
  onChange: (dateFrom: string | null, dateTo: string | null) => void;
  className?: string;
}

function DateRangeFilter({
  dateFrom,
  dateTo,
  onChange,
  className,
}: DateRangeFilterProps) {
  const dateRange: DateRange | undefined = useMemo(() => {
    if (!dateFrom) return undefined;
    return {
      from: new Date(dateFrom),
      to: dateTo ? new Date(dateTo) : undefined,
    };
  }, [dateFrom, dateTo]);

  const handleChange = (range: DateRange | undefined) => {
    if (range?.from) {
      const fromStr = format(range.from, 'yyyy-MM-dd');
      const toStr = range.to ? format(range.to, 'yyyy-MM-dd') : null;
      onChange(fromStr, toStr);
    } else {
      onChange(null, null);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !dateRange && 'text-muted-foreground',
            className,
          )}
          data-test="distributor-date-range-filter"
        >
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
          <CalendarIcon className="text-primary ml-auto h-4 w-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="range"
          defaultMonth={dateRange?.from}
          selected={dateRange}
          onSelect={handleChange}
          numberOfMonths={1}
        />
        {dateRange && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => handleChange(undefined)}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function MobileTopDistributorTable({
  rows,
  currentDistributorId,
}: {
  rows: DistributorTopRanking[];
  currentDistributorId: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No distributor data yet
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="py-4 pl-4">Distributor</TableHead>
          <TableHead className="text-right">
            <span className="block text-xs">Cards</span>
            <span className="text-muted-foreground block text-xs">
              Activated
            </span>
          </TableHead>
          <TableHead className="text-right">
            <span className="block text-xs">Total</span>
            <span className="text-muted-foreground block text-xs">Cards</span>
          </TableHead>
          <TableHead className="pr-4 text-right">Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((d) => {
          const isCurrent = d.distributor_id === currentDistributorId;
          return (
            <TableRow
              key={d.distributor_id}
              className={cn(isCurrent && 'bg-muted/60 font-medium')}
            >
              <TableCell className="max-w-[100px] truncate py-4 pl-4 text-sm">
                {d.distributor_name}
                {isCurrent && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    (you)
                  </span>
                )}
              </TableCell>
              <TableCell className="py-4 text-right text-sm">
                {formatNumber(d.cards_activated)}
              </TableCell>
              <TableCell className="py-4 text-right text-sm">
                {formatNumber(d.total_cards)}
              </TableCell>
              <TableCell className="py-4 pr-4 text-right text-sm">
                {formatCurrency(d.revenue_cents)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function DesktopTopDistributorTable({
  rows,
  currentDistributorId,
}: {
  rows: DistributorTopRanking[];
  currentDistributorId: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No distributor data yet
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="py-4 pl-4">Distributor</TableHead>
          <TableHead className="py-4 text-right">Cards Activated</TableHead>
          <TableHead className="py-4 text-right">Total Cards</TableHead>
          <TableHead className="py-4 pr-4 text-right">Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((d) => {
          const isCurrent = d.distributor_id === currentDistributorId;
          return (
            <TableRow
              key={d.distributor_id}
              className={cn(isCurrent && 'bg-muted/60 font-medium')}
            >
              <TableCell className="py-4 pl-4">
                {d.distributor_name}
                {isCurrent && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    (you)
                  </span>
                )}
              </TableCell>
              <TableCell className="py-4 text-right">
                {formatNumber(d.cards_activated)}
              </TableCell>
              <TableCell className="py-4 text-right">
                {formatNumber(d.total_cards)}
              </TableCell>
              <TableCell className="py-4 pr-4 text-right">
                {formatCurrency(d.revenue_cents)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function DistributorDashboard({ data }: DistributorDashboardProps) {
  const {
    distributorId,
    distributorName,
    shareSlug,
    cardStats,
    totalEarnings,
    salesTrend,
    recentActivities,
    topDistributors,
  } = data;

  const { filters, setDateRangeFilter, isPending } = useDashboardFilters();

  const [activitiesPage, setActivitiesPage] = useState(1);
  const activitiesPerPage = 5;
  const totalActivitiesPages = Math.ceil(
    recentActivities.length / activitiesPerPage,
  );
  const validPage = Math.min(activitiesPage, Math.max(1, totalActivitiesPages));
  const paginatedActivities = recentActivities.slice(
    (validPage - 1) * activitiesPerPage,
    validPage * activitiesPerPage,
  );

  const chartData = useMemo(
    () =>
      salesTrend.map((d) => ({
        name: d.month,
        sales: d.sales_count,
        revenue: d.revenue_cents / 100,
      })),
    [salesTrend],
  );

  const pieData = useMemo(
    () => [
      {
        name: 'Sold',
        value: cardStats.activated,
        color: 'var(--brand)',
      },
      {
        name: 'Remaining',
        value: Math.max(0, cardStats.total_assigned - cardStats.activated),
        color: 'var(--color-gray-200)',
      },
    ],
    [cardStats.activated, cardStats.total_assigned],
  );

  const soldPercentage =
    cardStats.total_assigned > 0
      ? Math.min(
          100,
          (cardStats.activated / cardStats.total_assigned) * 100,
        ).toFixed(1)
      : '0';

  return (
    <div
      className={cn(
        'space-y-4 pb-4 transition-opacity duration-200 md:space-y-6',
        isPending && 'pointer-events-none opacity-60',
      )}
    >
      <DashboardPageHeader
        subtitle={distributorName ?? undefined}
        title="Dashboard"
      />

      <DistributorShareLinkCard shareSlug={shareSlug} className="md:hidden" />

      {/* Mobile KPI Cards - Horizontal scroll, ~2 cards visible with peek of next */}
      <div
        role="region"
        aria-label="Dashboard statistics"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
      >
        <div className="min-w-[calc(44%-4px)] flex-shrink-0 snap-start">
          <SimpleStatCard
            icon={Wallet}
            label="Total Cards"
            value={cardStats.total_assigned}
            format="number"
          />
        </div>
        <div className="min-w-[calc(44%-4px)] flex-shrink-0 snap-start">
          <SimpleStatCard
            icon={CreditCardX}
            label="Inactive Cards"
            value={cardStats.remaining}
            format="number"
          />
        </div>
        <div className="min-w-[calc(44%-4px)] flex-shrink-0 snap-start">
          <SimpleStatCard
            icon={CreditCardCheck}
            label="Cards Activated"
            value={cardStats.activated}
            format="number"
          />
        </div>
        <div className="min-w-[calc(44%-4px)] flex-shrink-0 snap-start">
          <SimpleStatCard
            icon={CircleDollarSign}
            label="Total Revenue"
            value={totalEarnings}
            format="currency"
          />
        </div>
      </div>

      {/* Desktop: 4 KPI cards in one row */}
      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
        <SimpleStatCard
          icon={Wallet}
          label="Total Cards"
          value={cardStats.total_assigned}
          format="number"
        />
        <SimpleStatCard
          icon={CreditCardX}
          label="Inactive Cards"
          value={cardStats.remaining}
          format="number"
        />
        <SimpleStatCard
          icon={CreditCardCheck}
          label="Cards Activated"
          value={cardStats.activated}
          format="number"
        />
        <SimpleStatCard
          icon={CircleDollarSign}
          label="Total Revenue"
          value={totalEarnings}
          format="currency"
        />
      </div>

      {/* Date Range Filter - right-aligned, below KPIs, above 2x2 widgets */}
      <div className="flex justify-end">
        <DateRangeFilter
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChange={setDateRangeFilter}
          className="w-full sm:w-auto sm:min-w-[260px]"
        />
      </div>

      {/* 2x2 Grid: [Sales Trend][Cards Sold vs. Assigned] / [Recent Activities][Top Distributors] */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {/* Sales Trend */}
        <DashboardAreaChart
          title="Sales Trend"
          icon={TrendingUp}
          data={chartData}
          series={[
            {
              dataKey: 'sales',
              label: 'Sales',
              color: 'brand',
              stroke: '#095BB4',
              gradientFrom: '#095BB4',
              gradientTo: '#F2F8FF',
            },
          ]}
          xAxisKey="name"
          height={250}
        />

        {/* Cards Sold vs. Assigned */}
        <div
          className="rounded-lg"
          style={{ boxShadow: '0px 1px 2px 0px #0000000D' }}
        >
          <Card>
            <CardHeader className="bg-muted flex flex-row items-center gap-3 rounded-t-lg p-3">
              <PieChartIcon className="text-muted-foreground h-4 w-4" />
              <CardTitle className="text-muted-foreground text-base font-medium">
                Cards Sold vs. Assigned
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <ChartContainer
                config={distributionChartConfig}
                className="mx-auto aspect-square w-full max-w-[280px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="value"
                      nameKey="name"
                      strokeWidth={2}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                            return (
                              <text
                                x={viewBox.cx}
                                y={viewBox.cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) - 8}
                                  className="fill-foreground text-2xl font-bold"
                                >
                                  {formatCurrency(totalEarnings)}
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 16}
                                  className="fill-muted-foreground text-xs"
                                >
                                  Total Earnings
                                </tspan>
                              </text>
                            );
                          }
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
              <p className="text-muted-foreground mt-4 text-center text-sm">
                {formatNumber(cardStats.activated)} sold out of{' '}
                {formatNumber(cardStats.total_assigned)} assigned (
                {soldPercentage}%)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities */}
        <div
          className="rounded-lg"
          style={{ boxShadow: '0px 1px 2px 0px #0000000D' }}
        >
          <Card>
            <CardHeader className="bg-muted flex flex-row items-center gap-3 rounded-t-lg p-3">
              <Activity className="text-muted-foreground h-4 w-4" />
              <CardTitle className="text-muted-foreground text-base font-medium">
                Recent Activities
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              {recentActivities.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No recent activities
                </p>
              ) : (
                <div className="space-y-3 pt-4">
                  {paginatedActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                        <Clock className="text-muted-foreground h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {activity.message}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDateFull(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {totalActivitiesPages > 1 && (
                    <div className="flex items-center justify-center gap-1 pt-4">
                      {Array.from(
                        { length: Math.min(totalActivitiesPages, 5) },
                        (_, i) => i + 1,
                      ).map((page) => (
                        <Button
                          key={page}
                          variant={page === validPage ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setActivitiesPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                      {totalActivitiesPages > 5 && (
                        <span className="text-muted-foreground px-2 text-sm">
                          ...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Distributor Performance */}
        <div
          className="rounded-lg"
          style={{ boxShadow: '0px 1px 2px 0px #0000000D' }}
        >
          <Card>
            <CardHeader className="bg-muted flex flex-row items-center gap-3 rounded-t-lg p-3">
              <Users className="text-muted-foreground h-4 w-4" />
              <CardTitle className="text-muted-foreground text-base font-medium">
                Top Distributor Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="md:hidden">
                <MobileTopDistributorTable
                  rows={topDistributors}
                  currentDistributorId={distributorId}
                />
              </div>
              <div className="hidden md:block">
                <DesktopTopDistributorTable
                  rows={topDistributors}
                  currentDistributorId={distributorId}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
