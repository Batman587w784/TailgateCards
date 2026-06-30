'use client';

import { useMemo } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { format } from 'date-fns';
import {
  Activity,
  AreaChart,
  ChevronDown,
  CreditCard,
  Filter,
  HandHelping,
  PieChart,
  UserPlus,
  Users,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Calendar as CalendarPicker } from '@kit/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { Trans } from '@kit/ui/trans';

import {
  DashboardAreaChart,
  DashboardDonutChart,
  SimpleStatCard,
} from '~/_components/dashboard';

import type { VisitorInsightsData } from '../../../_lib/server/visitor-insights.loader';

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

interface VisitorInsightsDashboardProps {
  data: VisitorInsightsData;
}

export function VisitorInsightsDashboard({
  data,
}: VisitorInsightsDashboardProps) {
  const { kpiStats, redemptionsOverTime, visitAnalytics, recentScans } = data;

  const router = useRouter();
  const searchParams = useSearchParams();

  // Get current filter values from URL
  const dateFrom = searchParams.get('from');
  const dateTo = searchParams.get('to');

  const dateRange: DateRange | undefined = useMemo(() => {
    if (!dateFrom) return undefined;
    return {
      from: new Date(dateFrom),
      to: dateTo ? new Date(dateTo) : undefined,
    };
  }, [dateFrom, dateTo]);

  // Handle date range change
  const handleDateRangeChange = (range: DateRange | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (range?.from) {
      const fromDate: Date = range.from;
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
    router.push(`?${params.toString()}`);
  };

  // Format chart data for area chart
  const areaChartData = useMemo(
    () =>
      redemptionsOverTime.map((d) => ({
        name: d.month,
        redemptions: d.redemption_count,
      })),
    [redemptionsOverTime],
  );

  // Format donut chart segments with colors matching Card Usage chart
  const donutSegments = useMemo(
    () => [
      {
        name: 'New Visitor',
        value: visitAnalytics.one_visit,
        color: '#2A9D90',
      },
      {
        name: 'Visited 2 times',
        value: visitAnalytics.two_visits,
        color: '#E76E50',
      },
      {
        name: 'Visited 3 times',
        value: visitAnalytics.three_visits,
        color: '#274754',
      },
      {
        name: 'Visited 4+ times',
        value: visitAnalytics.four_plus_visits,
        color: '#E8C468',
      },
    ],
    [visitAnalytics],
  );

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-[200px]">
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

      {/* KPI Tiles - Custom mobile layout */}
      <div className="space-y-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0">
        {/* Total Redemptions - Full width on mobile */}
        <div className="w-full sm:col-span-1">
          <SimpleStatCard
            icon={HandHelping}
            label="Total Redemptions"
            value={kpiStats.total_redemptions}
            format="number"
          />
        </div>

        {/* New Visitors and Avg. Visits - 50/50 on mobile */}
        <div className="grid grid-cols-2 gap-4 sm:contents">
          <SimpleStatCard
            icon={UserPlus}
            label="New Visitors"
            value={kpiStats.new_visitors}
            format="number"
          />
          <SimpleStatCard
            icon={Users}
            label="Avg. Visits per User"
            value={kpiStats.avg_visits_per_user}
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Area Chart - Redemptions Over Time */}
        <DashboardAreaChart
          title="Redemptions Over Time"
          icon={AreaChart}
          data={areaChartData}
          series={[
            {
              dataKey: 'redemptions',
              label: 'Redemptions',
              color: '#095BB4',
              gradientFrom: '#095BB4',
              gradientTo: '#F2F8FF',
            },
          ]}
          xAxisKey="name"
        />

        {/* Donut Chart - Visit Analytics */}
        <DashboardDonutChart
          title="Visit Analytics"
          icon={PieChart}
          segments={donutSegments}
          centerLabel="Visitors"
          centerValue={visitAnalytics.total_unique_visitors}
        />
      </div>

      {/* Recent Scans List */}
      <Card>
        <CardHeader className="bg-muted flex flex-row items-center gap-3 rounded-t-lg p-3">
          <Activity className="text-muted-foreground h-4 w-4" />
          <CardTitle className="text-muted-foreground text-base font-medium">
            <Trans
              i18nKey="merchant:recentScans.title"
              defaults="Recent Scans"
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentScans.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <Trans
                i18nKey="merchant:visitorInsights.noScans"
                defaults="No recent scans"
              />
            </div>
          ) : (
            <div className="flex flex-col divide-y">
              {recentScans.map((scan) => {
                const date = new Date(scan.redeemed_at);
                return (
                  <div
                    key={scan.id}
                    className="flex items-start justify-between px-6 py-4"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-brand font-medium">
                        #{scan.discount_id.slice(0, 4).toUpperCase()} -{' '}
                        {scan.discount_title}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1 text-sm">
                        <CreditCard className="h-4 w-4" />
                        Card ID: {scan.card_code}
                      </span>
                    </div>
                    <div className="text-muted-foreground flex flex-col items-end text-sm">
                      <span>
                        {date.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </span>
                      <span>
                        {date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
