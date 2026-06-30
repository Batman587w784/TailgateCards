'use client';

import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { ScrollArea } from '@kit/ui/scroll-area';

import type { FilterOption } from '../_lib/types/filter.types';

interface CardsFilterCategoryProps {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}

const MAX_VISIBLE_ITEMS = 3;
const ITEM_HEIGHT = 28;

export function CardsFilterCategory({
  label,
  options,
  selectedValues,
  onToggle,
}: CardsFilterCategoryProps) {
  const needsScroll = options.length > MAX_VISIBLE_ITEMS;
  const scrollHeight = MAX_VISIBLE_ITEMS * ITEM_HEIGHT;

  const content = (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <div key={option.id} className="flex items-center gap-2">
          <Checkbox
            id={`filter-${label}-${option.id}`}
            checked={selectedValues.includes(option.id)}
            onCheckedChange={() => onToggle(option.id)}
          />
          <Label
            htmlFor={`filter-${label}-${option.id}`}
            className="cursor-pointer text-sm font-normal"
          >
            {option.label}
          </Label>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {needsScroll ? (
        <div className="relative">
          <ScrollArea className="pr-3" style={{ height: scrollHeight }}>
            {content}
          </ScrollArea>
          <div className="from-background pointer-events-none absolute right-3 bottom-0 left-0 h-4 bg-gradient-to-t to-transparent" />
        </div>
      ) : (
        content
      )}
    </div>
  );
}
