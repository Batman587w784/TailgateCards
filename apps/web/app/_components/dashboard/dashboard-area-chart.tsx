'use client';

import { useMemo } from 'react';

import type { LucideIcon } from 'lucide-react';
import { BarChart3 } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@kit/ui/chart';

interface Series {
  dataKey: string;
  label: string;
  color: string;
  stroke?: string;
  gradientFrom?: string;
  gradientTo?: string;
}

interface DashboardAreaChartProps {
  title: string;
  icon?: LucideIcon;
  data: Record<string, string | number>[];
  series: Series[];
  xAxisKey?: string;
  showLegend?: boolean;
  height?: number;
  formatYAxis?: (value: number) => string;
}

export function DashboardAreaChart({
  title,
  icon: Icon = BarChart3,
  data,
  series,
  xAxisKey = 'name',
  showLegend = false,
  height = 250,
  formatYAxis,
}: DashboardAreaChartProps) {
  // Helper to resolve color - supports both CSS variable names and hex colors
  const getColor = (color: string) =>
    color.startsWith('#') ? color : `var(--${color})`;

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    series.forEach((s) => {
      config[s.dataKey] = {
        label: s.label,
        color: getColor(s.color),
      };
    });
    return config;
  }, [series]);

  const gradientIds = useMemo(
    () =>
      series.map((s) => ({
        id: `fill${s.dataKey}`,
        color: s.color,
        gradientFrom: s.gradientFrom,
        gradientTo: s.gradientTo,
      })),
    [series],
  );

  return (
    <div
      className="rounded-lg"
      style={{ boxShadow: '0px 1px 2px 0px #0000000D' }}
    >
      <Card>
        <CardHeader className="bg-muted flex flex-row items-center gap-3 rounded-t-lg p-3">
          <Icon className="text-muted-foreground h-4 w-4" />
          <CardTitle className="text-muted-foreground text-base font-medium">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={chartConfig}
            className="w-full"
            style={{ height: `${height}px` }}
          >
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                {gradientIds.map(({ id, color, gradientFrom, gradientTo }) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={gradientFrom ?? getColor(color)}
                      stopOpacity={gradientFrom ? 1 : 0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={gradientTo ?? getColor(color)}
                      stopOpacity={gradientTo ? 1 : 0}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey={xAxisKey}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
                tickFormatter={formatYAxis}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              {series.map((s) => (
                <Area
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  stroke={s.stroke ?? getColor(s.color)}
                  fill={`url(#fill${s.dataKey})`}
                  strokeWidth={2}
                  stackId={series.length > 1 ? 'stack' : undefined}
                />
              ))}
              {showLegend && <Legend />}
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
