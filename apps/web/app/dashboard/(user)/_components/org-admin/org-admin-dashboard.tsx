'use client';

import { useMemo, useState } from 'react';

import {
  Activity,
  ChevronDown,
  CreditCard,
  DollarSign,
  Filter,
  PieChart as PieChartIcon,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { Cell, Label, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@kit/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { cn } from '@kit/ui/utils';

import {
  DashboardAreaChart,
  RankingTable,
  SimpleStatCard,
} from '~/_components/dashboard';

import { useDashboardFilters } from '../../_lib/hooks/use-dashboard-filters';
import type {
  OrgAdminDashboardData,
  TopDistributor,
} from '../../_lib/server/org-admin-dashboard.loader';
import { DashboardPageHeader } from '../dashboard-page-header';
import {
  DashboardFilterButton,
  DashboardFilterContent,
} from './dashboard-filter-panel';

interface OrgAdminDashboardProps {
  data: OrgAdminDashboardData;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
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

// Mobile compact table for distributors
function MobileDistributorTable({
  distributors,
}: {
  distributors: TopDistributor[];
}) {
  if (distributors.length === 0) {
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
        {distributors.map((d) => (
          <TableRow key={d.distributor_id}>
            <TableCell className="max-w-[100px] truncate py-4 pl-4 text-sm">
              {d.distributor_name}
            </TableCell>
            <TableCell className="py-4 text-right text-sm">
              {formatNumber(Number(d.cards_activated))}
            </TableCell>
            <TableCell className="py-4 text-right text-sm">
              {formatNumber(Number(d.total_cards))}
            </TableCell>
            <TableCell className="py-4 pr-4 text-right text-sm">
              {formatCurrency(Number(d.revenue_cents))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function OrgAdminDashboard({ data }: OrgAdminDashboardProps) {
  const {
    organizationName,
    cardStats,
    revenueStats,
    distributorStats,
    salesData,
    topDistributors,
    recentActivations,
    cardsDistribution,
    distributorsForFilter,
  } = data;

  // Filter panel state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // URL-based filters
  const {
    filters,
    activeFilterCount,
    setDistributorFilter,
    setDateRangeFilter,
    clearFilters,
    isPending,
  } = useDashboardFilters();

  // Pagination for recent activations on mobile
  const [activationsPage, setActivationsPage] = useState(1);
  const activationsPerPage = 5;
  const totalActivationsPages = Math.ceil(
    recentActivations.length / activationsPerPage,
  );
  // Ensure page is valid after filtering (auto-reset if current page exceeds total)
  const validPage = Math.min(
    activationsPage,
    Math.max(1, totalActivationsPages),
  );
  const paginatedActivations = recentActivations.slice(
    (validPage - 1) * activationsPerPage,
    validPage * activationsPerPage,
  );

  // Format sales data for chart (convert cents to dollars)
  const chartData = useMemo(
    () =>
      salesData.map((d) => ({
        name: d.month,
        revenue: d.revenue_cents / 100,
        sales: d.sales_count,
      })),
    [salesData],
  );

  // Prepare pie chart data for cards distribution (Sold vs Remaining from assigned cards)
  const pieData = useMemo(
    () => [
      {
        name: 'Sold',
        value: cardsDistribution.activated_cards,
        color: 'var(--brand)',
      },
      {
        name: 'Remaining',
        value: Math.max(
          0,
          cardsDistribution.assigned_cards - cardsDistribution.activated_cards,
        ),
        color: 'var(--color-gray-200)',
      },
    ],
    [cardsDistribution],
  );

  // Format top distributors for ranking table
  const formattedDistributors = useMemo(
    () =>
      topDistributors.map((d) => ({
        ...d,
        cards_activated: Number(d.cards_activated),
        total_cards: Number(d.total_cards),
        revenue_cents: Number(d.revenue_cents),
      })),
    [topDistributors],
  );

  // Calculate sold percentage (sold out of assigned, capped at 100%)
  const soldPercentage =
    cardsDistribution.assigned_cards > 0
      ? Math.min(
          100,
          (cardsDistribution.activated_cards /
            cardsDistribution.assigned_cards) *
            100,
        ).toFixed(1)
      : '0';

  return (
    <div
      className={cn(
        'space-y-4 pb-4 transition-opacity duration-200 md:space-y-6',
        isPending && 'pointer-events-none opacity-60',
      )}
    >
      {/* Header with Filter Button */}
      <div className="flex items-center justify-between">
        <DashboardPageHeader subtitle={organizationName} title="Dashboard" />

        {/* Desktop Filter Button */}
        <div className="hidden md:block">
          <DashboardFilterButton
            isOpen={filterPanelOpen}
            onToggle={() => setFilterPanelOpen(!filterPanelOpen)}
            activeFilterCount={activeFilterCount}
          />
        </div>
      </div>

      {/* Desktop Filter Panel (expandable) */}
      {filterPanelOpen && (
        <div className="hidden md:block">
          <DashboardFilterContent
            filters={filters}
            activeFilterCount={activeFilterCount}
            distributors={distributorsForFilter}
            onDistributorChange={setDistributorFilter}
            onDateRangeChange={setDateRangeFilter}
            onClear={clearFilters}
          />
        </div>
      )}

      {/* Mobile KPI Cards - Horizontal scroll, 2 cards visible */}
      <div
        role="region"
        aria-label="Dashboard statistics"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
      >
        <div className="min-w-[calc(44%-4px)] flex-shrink-0 snap-start">
          <SimpleStatCard
            icon={CreditCard}
            label="Total Cards"
            value={cardStats.total_cards}
            format="number"
          />
        </div>
        <div className="min-w-[calc(44%-4px)] flex-shrink-0 snap-start">
          <SimpleStatCard
            icon={CreditCard}
            label="Inactive Cards"
            value={cardStats.inactive_cards}
            format="number"
            subValue="Pending activation"
          />
        </div>
        <div className="min-w-[calc(44%-4px)] flex-shrink-0 snap-start">
          <SimpleStatCard
            icon={CreditCard}
            label="Unassigned Cards"
            value={cardStats.unassigned_cards}
            format="number"
            subValue="Not assigned to distributors"
          />
        </div>
        <div className="min-w-[calc(44%-4px)] flex-shrink-0 snap-start">
          <SimpleStatCard
            icon={UserCheck}
            label="Cards Activated"
            value={cardStats.cards_activated}
            format="number"
          />
        </div>
        <div className="min-w-[calc(44%-4px)] flex-shrink-0 snap-start">
          <SimpleStatCard
            icon={DollarSign}
            label="Total Revenue"
            value={revenueStats.total_activated_revenue_cents}
            format="currency"
          />
        </div>
        <div className="min-w-[calc(44%-4px)] flex-shrink-0 snap-start">
          <SimpleStatCard
            icon={Users}
            label="Active Distributors"
            value={distributorStats.active_distributors}
            format="number"
            subValue={`of ${distributorStats.total_distributors} total`}
          />
        </div>
      </div>

      {/* Desktop KPI Grid - All 6 cards */}
      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
        <SimpleStatCard
          icon={CreditCard}
          label="Total Cards"
          value={cardStats.total_cards}
          format="number"
        />
        <SimpleStatCard
          icon={CreditCard}
          label="Inactive Cards"
          value={cardStats.inactive_cards}
          format="number"
          subValue="Pending activation"
        />
        <SimpleStatCard
          icon={CreditCard}
          label="Unassigned Cards"
          value={cardStats.unassigned_cards}
          format="number"
          subValue="Not assigned to distributors"
        />
        <SimpleStatCard
          icon={UserCheck}
          label="Cards Activated"
          value={cardStats.cards_activated}
          format="number"
        />
        <SimpleStatCard
          icon={DollarSign}
          label="Total Revenue"
          value={revenueStats.total_activated_revenue_cents}
          format="currency"
        />
        <SimpleStatCard
          icon={Users}
          label="Active Distributors"
          value={distributorStats.active_distributors}
          format="number"
          subValue={`of ${distributorStats.total_distributors} total`}
        />
      </div>

      {/* Mobile Filter Button */}
      <div className="md:hidden">
        <Button
          variant="outline"
          onClick={() => setFilterPanelOpen(!filterPanelOpen)}
          className="w-full gap-2"
          data-test="mobile-filter-button"
        >
          <Filter className="h-4 w-4" />
          Filter
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
              {activeFilterCount}
            </span>
          )}
          {filterPanelOpen ? (
            <ChevronDown className="ml-auto h-4 w-4 rotate-180" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Mobile Filter Panel (expandable) */}
      {filterPanelOpen && (
        <div className="md:hidden">
          <DashboardFilterContent
            filters={filters}
            activeFilterCount={activeFilterCount}
            distributors={distributorsForFilter}
            onDistributorChange={setDistributorFilter}
            onDateRangeChange={setDateRangeFilter}
            onClear={clearFilters}
          />
        </div>
      )}

      {/* Mobile: Sales Overview Chart - Full width */}
      <div className="md:hidden">
        <DashboardAreaChart
          title="Sales Overview"
          icon={TrendingUp}
          data={chartData}
          series={[
            {
              dataKey: 'revenue',
              label: 'Revenue',
              color: 'brand-400',
              stroke: '#3342FF',
            },
          ]}
          xAxisKey="name"
          formatYAxis={(value: number) => formatCurrency(value * 100)}
        />
      </div>

      {/* Mobile: Cards Distribution */}
      <div
        className="rounded-lg md:hidden"
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
                    innerRadius={45}
                    outerRadius={70}
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
                                className="fill-foreground text-lg font-bold"
                              >
                                {formatCurrency(
                                  cardsDistribution.total_raised_cents,
                                )}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 12}
                                className="fill-muted-foreground text-xs"
                              >
                                Total Raised
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
              {formatNumber(cardsDistribution.activated_cards)} sold out of{' '}
              {formatNumber(cardsDistribution.assigned_cards)} assigned (
              {soldPercentage}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mobile: Top Distributor Performance */}
      <div
        className="rounded-lg md:hidden"
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
            <MobileDistributorTable distributors={formattedDistributors} />
          </CardContent>
        </Card>
      </div>

      {/* Desktop: Sales Overview + Top Distributor Performance */}
      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <DashboardAreaChart
          title="Sales Overview"
          icon={TrendingUp}
          data={chartData}
          series={[
            {
              dataKey: 'revenue',
              label: 'Revenue',
              color: 'brand-400',
              stroke: '#3342FF',
            },
          ]}
          xAxisKey="name"
          formatYAxis={(value: number) => formatCurrency(value * 100)}
        />

        <RankingTable
          title="Top Distributor Performance"
          icon={Users}
          columns={[
            { key: 'distributor_name', label: 'Distributor' },
            {
              key: 'cards_activated',
              label: 'Cards Activated',
              format: 'number',
              align: 'right',
            },
            {
              key: 'total_cards',
              label: 'Total Cards',
              format: 'number',
              align: 'right',
            },
            {
              key: 'revenue_cents',
              label: 'Revenue',
              format: 'currency',
              align: 'right',
            },
          ]}
          data={formattedDistributors}
          emptyMessage="No distributor data yet"
        />
      </div>

      {/* Mobile: Recent Activations */}
      <div
        className="rounded-lg md:hidden"
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
                {paginatedActivations.map((activation) => (
                  <div
                    key={activation.activation_id}
                    className="flex items-start justify-between px-6 py-4"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-brand font-medium">
                        {activation.cardholder_name ?? 'Unknown'}
                      </span>
                      <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Card ID: {activation.display_code}</span>
                      </div>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-sm">
                      {formatDate(activation.activated_at)}
                    </span>
                  </div>
                ))}

                {/* Mobile pagination */}
                {totalActivationsPages > 1 && (
                  <div className="flex items-center justify-center gap-1 py-4">
                    {Array.from(
                      { length: totalActivationsPages },
                      (_, i) => i + 1,
                    ).map((page) => (
                      <Button
                        key={page}
                        variant={
                          page === activationsPage ? 'default' : 'outline'
                        }
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setActivationsPage(page)}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Desktop: Recent Activations (2/3) + Cards Sold vs. Assigned (1/3) */}
      <div className="hidden gap-4 md:grid md:grid-cols-3">
        {/* Recent Activations - 2/3 width */}
        <div
          className="rounded-lg md:col-span-2"
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
                  {recentActivations.slice(0, 5).map((activation) => (
                    <div
                      key={activation.activation_id}
                      className="flex items-start justify-between px-6 py-4"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-brand font-medium">
                          {activation.cardholder_name ?? 'Unknown'}
                        </span>
                        <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>Card ID: {activation.display_code}</span>
                        </div>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-sm">
                        {formatDate(activation.activated_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cards Sold vs. Assigned Pie Chart - 1/3 width */}
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
                className="mx-auto aspect-square w-full"
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
                                  {formatCurrency(
                                    cardsDistribution.total_raised_cents,
                                  )}
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 16}
                                  className="fill-muted-foreground text-xs"
                                >
                                  Total Raised
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
                {formatNumber(cardsDistribution.activated_cards)} sold out of{' '}
                {formatNumber(cardsDistribution.assigned_cards)} assigned (
                {soldPercentage}%)
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
