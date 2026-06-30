'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';

import type { SalesCardTypeFilter } from '../_lib/types/sales-filter.types';

const options: { value: SalesCardTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'physical', label: 'Physical' },
  { value: 'digital', label: 'Digital' },
];

interface CardTypeSelectProps {
  value: SalesCardTypeFilter;
  onChange: (value: SalesCardTypeFilter) => void;
  className?: string;
}

export function CardTypeSelect({
  value,
  onChange,
  className,
}: CardTypeSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as SalesCardTypeFilter)}
    >
      <SelectTrigger
        className={cn('h-9 w-40', className)}
        aria-label="Card type"
        data-test="cards-card-type-select"
      >
        <SelectValue placeholder="Card type" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            data-test={`cards-card-type-option-${option.value}`}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
