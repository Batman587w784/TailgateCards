'use client';

import { Button } from '@kit/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';

import type { CardsFilters, FilterCategory } from '../_lib/types/filter.types';
import { CardsFilterCategory } from './cards-filter-category';

interface CardsFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FilterCategory[];
  selectedFilters: CardsFilters;
  activeFilterCount: number;
  onToggle: (category: keyof CardsFilters, value: string) => void;
  onClear: () => void;
}

export function CardsFilterDrawer({
  open,
  onOpenChange,
  categories,
  selectedFilters,
  activeFilterCount,
  onToggle,
  onClear,
}: CardsFilterDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-6">
          {categories.map((category) => (
            <CardsFilterCategory
              key={category.id}
              label={category.label}
              options={category.options}
              selectedValues={selectedFilters[category.id] ?? []}
              onToggle={(value) => onToggle(category.id, value)}
            />
          ))}

          {activeFilterCount > 0 && (
            <div className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClear();
                  onOpenChange(false);
                }}
                className="w-full"
              >
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
