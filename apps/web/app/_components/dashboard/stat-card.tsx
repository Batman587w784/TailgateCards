'use client';

import { useState } from 'react';

import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react';

import { Card, CardContent, CardTitle } from '@kit/ui/card';

interface StatItem {
  label: string;
  value: string | number;
  format?: 'number' | 'currency' | 'percent';
  subStats?: StatItem[];
}

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  stats: StatItem[];
  variant?: 'default' | 'primary';
}

function formatValue(value: string | number, format?: StatItem['format']) {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value / 100);
    case 'percent':
      return `${value}%`;
    case 'number':
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
}

export function StatCard({ icon: Icon, title, stats, variant }: StatCardProps) {
  return (
    <Card
      className={variant === 'primary' ? 'border-primary bg-primary/5' : ''}
      style={{
        boxShadow: '0px 12px 24px -4px #919EAB1F, 0px 0px 2px 0px #919EAB33',
      }}
    >
      <CardContent className="flex items-start gap-4 p-4">
        {/* Icon squircle 48x48 on the left */}
        <div className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
          <Icon className="text-brand h-6 w-6" />
        </div>

        {/* Title + KPIs on the right */}
        <div className="flex-1">
          <CardTitle className="mb-3 text-base font-medium">{title}</CardTitle>
          <ul className="space-y-2">
            {stats.map((stat) => (
              <StatRow key={stat.label} stat={stat} />
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function StatRow({ stat }: { stat: StatItem }) {
  const hasSubStats = !!stat.subStats?.length;
  const [expanded, setExpanded] = useState(true);

  return (
    <li>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="bg-primary h-1.5 w-1.5 rounded-full" />
          {stat.label}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {formatValue(stat.value, stat.format)}
          </span>
          {hasSubStats &&
            (expanded ? (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label={`Collapse ${stat.label}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label={`Expand ${stat.label}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            ))}
        </div>
      </div>

      {hasSubStats && expanded && (
        <ul className="mt-2 space-y-2 pl-4">
          {stat.subStats!.map((sub) => (
            <li key={sub.label} className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">{sub.label}</span>
              <span className="font-semibold">
                {formatValue(sub.value, sub.format)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
