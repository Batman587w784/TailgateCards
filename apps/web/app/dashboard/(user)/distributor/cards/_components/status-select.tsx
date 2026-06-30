'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';

import type { SalesStatusFilter } from '../_lib/types/sales-filter.types';

const options: { value: SalesStatusFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

interface StatusSelectProps {
  value: SalesStatusFilter;
  onChange: (value: SalesStatusFilter) => void;
  className?: string;
}

export function StatusSelect({
  value,
  onChange,
  className,
}: StatusSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as SalesStatusFilter)}
    >
      <SelectTrigger
        className={cn('h-9 w-[160px]', className)}
        aria-label="Card status"
        data-test="cards-status-select"
      >
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            data-test={`cards-status-option-${option.value}`}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
