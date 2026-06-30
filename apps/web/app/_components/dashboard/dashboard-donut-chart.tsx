'use client';

import { useMemo } from 'react';

import type { LucideIcon } from 'lucide-react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Cell, Label, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@kit/ui/chart';

interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

interface DashboardDonutChartProps {
  title: string;
  icon?: LucideIcon;
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string | number;
}

export function DashboardDonutChart({
  title,
  icon: Icon = PieChartIcon,
  segments,
  centerLabel,
  centerValue,
}: DashboardDonutChartProps) {
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    segments.forEach((s) => {
      config[s.name] = {
        label: s.name,
        color: s.color,
      };
    });
    return config;
  }, [segments]);

  return (
    <Card>
      <CardHeader className="bg-muted flex flex-row items-center gap-3 rounded-t-lg p-3">
        <Icon className="text-muted-foreground h-4 w-4" />
        <CardTitle className="text-muted-foreground text-base font-medium">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-6">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-around">
          <ChartContainer config={chartConfig} className="h-[200px] w-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={segments}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={2}
                >
                  {segments.map((entry, index) => (
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
                              y={viewBox.cy}
                              className="fill-foreground text-2xl font-bold"
                            >
                              {centerValue}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 20}
                              className="fill-muted-foreground text-xs"
                            >
                              {centerLabel}
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

          {/* Legend */}
          <div className="flex flex-col gap-3">
            {segments.map((segment) => (
              <div key={segment.name} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-muted-foreground text-sm">
                  {segment.name}
                </span>
                <span className="text-sm font-medium">({segment.value})</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
