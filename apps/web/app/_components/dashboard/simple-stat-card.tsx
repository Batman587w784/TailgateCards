import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@kit/ui/card';

interface SimpleStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subValue?: string;
  format?: 'number' | 'currency' | 'percent';
}

function formatValue(
  value: string | number,
  format?: SimpleStatCardProps['format'],
) {
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

export function SimpleStatCard({
  icon: Icon,
  label,
  value,
  subValue,
  format,
}: SimpleStatCardProps) {
  return (
    <Card
      style={{
        boxShadow: '0px 12px 24px -4px #919EAB1F, 0px 0px 2px 0px #919EAB33',
      }}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg lg:h-12 lg:w-12">
          <Icon className="h-6 w-6 text-[#0A2471]" />
        </div>
        <div className="flex-1">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="text-xl font-bold">{formatValue(value, format)}</p>
          {subValue && (
            <p className="text-muted-foreground text-xs">{subValue}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
