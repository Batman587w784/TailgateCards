'use client';

import { useMemo } from 'react';

import { AreaChart } from 'lucide-react';
import { Cell, Pie, PieChart } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { ChartConfig, ChartContainer } from '@kit/ui/chart';

interface CardUsageSegment {
  name: string;
  value: number;
  color: string;
}

interface CardUsageDonutChartProps {
  segments: CardUsageSegment[];
}

const CHART_SIZE = 250;
const INNER_RADIUS = 70;
const OUTER_RADIUS = 100;

export function CardUsageDonutChart({ segments }: CardUsageDonutChartProps) {
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

  const totalValue = segments.reduce((sum, seg) => sum + seg.value, 0);

  // Calculate label positions INSIDE the donut center (inner radius area)
  const labelPositions = useMemo(() => {
    if (totalValue === 0) return [];

    const positions: Array<{
      x: number;
      y: number;
      percentage: number;
    }> = [];

    let cumulativeAngle = -90; // Start from top (12 o'clock position)
    const centerX = CHART_SIZE / 2;
    const centerY = CHART_SIZE / 2;
    const RADIAN = Math.PI / 180;
    // Labels inside the center hole - between center and inner radius
    const labelRadius = INNER_RADIUS * 0.6;

    segments.forEach((segment) => {
      const percentage = (segment.value / totalValue) * 100;
      const sliceAngle = (segment.value / totalValue) * 360;
      const midAngle = cumulativeAngle + sliceAngle / 2;

      // Only show label if percentage is significant (>= 5%)
      if (percentage >= 5) {
        const x = centerX + labelRadius * Math.cos(midAngle * RADIAN);
        const y = centerY + labelRadius * Math.sin(midAngle * RADIAN);

        positions.push({
          x,
          y,
          percentage,
        });
      }

      cumulativeAngle += sliceAngle;
    });

    return positions;
  }, [segments, totalValue]);

  return (
    <div
      className="rounded-lg"
      style={{ boxShadow: '0px 1px 2px 0px #0000000D' }}
    >
      <Card>
        <CardHeader className="bg-muted flex flex-row items-center gap-3 rounded-t-lg p-3">
          <AreaChart className="text-muted-foreground h-4 w-4" />
          <CardTitle className="text-muted-foreground text-base font-medium">
            Card Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-around">
            {/* Chart container with relative positioning for labels */}
            <div
              className="relative"
              style={{ width: CHART_SIZE, height: CHART_SIZE }}
            >
              <ChartContainer
                config={chartConfig}
                className="absolute inset-0 h-full w-full"
              >
                <PieChart width={CHART_SIZE} height={CHART_SIZE}>
                  <Pie
                    data={segments}
                    cx="50%"
                    cy="50%"
                    innerRadius={INNER_RADIUS}
                    outerRadius={OUTER_RADIUS}
                    dataKey="value"
                    nameKey="name"
                    strokeWidth={2}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {segments.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>

              {/* Labels inside the donut center */}
              {labelPositions.map((pos, index) => (
                <span
                  key={`label-${index}`}
                  className="absolute text-xs font-semibold text-black"
                  style={{
                    left: pos.x,
                    top: pos.y,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {`${pos.percentage.toFixed(0)}%`}
                </span>
              ))}
            </div>

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
    </div>
  );
}
