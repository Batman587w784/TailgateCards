import type { LucideIcon } from 'lucide-react';
import { Trophy } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

interface Column {
  key: string;
  label: string;
  format?: 'text' | 'number' | 'currency';
  align?: 'left' | 'right';
}

interface RankingTableProps<T extends Record<string, unknown>> {
  title: string;
  icon?: LucideIcon;
  columns: Column[];
  data: T[];
  emptyMessage?: string;
}

function formatValue(value: unknown, format?: Column['format']): string {
  if (value === null || value === undefined) return '-';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format((value as number) / 100);
    case 'number':
      return new Intl.NumberFormat('en-US').format(value as number);
    case 'text':
    default:
      return String(value);
  }
}

export function RankingTable<T extends Record<string, unknown>>({
  title,
  icon: Icon = Trophy,
  columns,
  data,
  emptyMessage = 'No data available',
}: RankingTableProps<T>) {
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
        <CardContent className="p-0">
          {data.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {emptyMessage}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col, colIndex) => (
                    <TableHead
                      key={col.key}
                      className={`${colIndex === 0 ? 'pl-4' : ''} ${colIndex === columns.length - 1 ? 'pr-4' : ''} ${col.align === 'right' ? 'text-right' : ''} py-4`}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, index) => (
                  <TableRow key={index}>
                    {columns.map((col, colIndex) => (
                      <TableCell
                        key={col.key}
                        className={`py-4 ${colIndex === 0 ? 'pl-4' : ''} ${colIndex === columns.length - 1 ? 'pr-4' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                      >
                        {formatValue(row[col.key], col.format)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
