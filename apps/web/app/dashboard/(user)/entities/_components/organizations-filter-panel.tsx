'use client';

import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { CityAutocomplete } from './city-autocomplete';
import { StateAutocomplete } from './state-autocomplete';

export interface OrganizationsFilters {
  state: string;
  city: string;
}

interface OrganizationsFilterButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  activeFilterCount: number;
}

export function OrganizationsFilterButton({
  isOpen,
  onToggle,
  activeFilterCount,
}: OrganizationsFilterButtonProps) {
  return (
    <Button
      variant="outline"
      className="gap-2"
      onClick={onToggle}
      data-test="organizations-filter-button"
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

interface OrganizationsFilterContentProps {
  filters: OrganizationsFilters;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  onClear: () => void;
}

export function OrganizationsFilterContent({
  filters,
  onStateChange,
  onCityChange,
  onClear,
}: OrganizationsFilterContentProps) {
  const hasFilters = filters.state || filters.city;

  return (
    <div className="border-x border-b p-4">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">State</label>
          <StateAutocomplete
            value={filters.state}
            onValueChange={(value) => {
              onStateChange(value);
              // Reset city when state changes
              if (value !== filters.state) {
                onCityChange('');
              }
            }}
            placeholder="Select state..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">City</label>
          <CityAutocomplete
            value={filters.city}
            onValueChange={onCityChange}
            placeholder="Select city..."
            state={filters.state}
            disabled={!filters.state}
          />
        </div>
      </div>

      {hasFilters && (
        <div className="mt-4 border-t pt-4">
          <Button variant="ghost" size="sm" onClick={onClear} className="gap-2">
            <X className="h-4 w-4" />
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
}
