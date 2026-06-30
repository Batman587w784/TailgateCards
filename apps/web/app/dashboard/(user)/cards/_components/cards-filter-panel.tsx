'use client';

import { ChevronDown, ChevronUp, Filter } from 'lucide-react';

import { Button } from '@kit/ui/button';

import type { CardsFilters, FilterCategory } from '../_lib/types/filter.types';
import { CardsFilterCategory } from './cards-filter-category';

interface CardsFilterButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  activeFilterCount: number;
}

export function CardsFilterButton({
  isOpen,
  onToggle,
  activeFilterCount,
}: CardsFilterButtonProps) {
  return (
    <Button
      variant="outline"
      className="gap-2"
      onClick={onToggle}
      data-test="cards-filter-button"
    >
      <Filter className="h-4 w-4" />
      Filter
      {activeFilterCount > 0 && (
        <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
          {activeFilterCount}
        </span>
      )}
      {isOpen ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      )}
    </Button>
  );
}

interface CardsFilterContentProps {
  categories: FilterCategory[];
  selectedFilters: CardsFilters;
  activeFilterCount: number;
  onToggle: (category: keyof CardsFilters, value: string) => void;
  onClear: () => void;
}

export function CardsFilterContent({
  categories,
  selectedFilters,
  activeFilterCount,
  onToggle,
  onClear,
}: CardsFilterContentProps) {
  return (
    <div className="border-x border-b p-4">
      <div className="grid grid-cols-5 gap-6">
        {categories.map((category) => (
          <CardsFilterCategory
            key={category.id}
            label={category.label}
            options={category.options}
            selectedValues={selectedFilters[category.id] ?? []}
            onToggle={(value) => onToggle(category.id, value)}
          />
        ))}
      </div>
      {activeFilterCount > 0 && (
        <div className="mt-4 border-t pt-4">
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
}
