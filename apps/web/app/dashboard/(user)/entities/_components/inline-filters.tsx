'use client';

import { CityAutocomplete } from './city-autocomplete';
import { StateAutocomplete } from './state-autocomplete';

interface InlineFiltersProps {
  stateValue: string;
  cityValue: string;
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
}

export function InlineFilters({
  stateValue,
  cityValue,
  onStateChange,
  onCityChange,
}: InlineFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-32">
        <StateAutocomplete
          value={stateValue}
          onValueChange={onStateChange}
          placeholder="State"
        />
      </div>
      <div className="w-40">
        <CityAutocomplete
          value={cityValue}
          onValueChange={onCityChange}
          placeholder="City"
          state={stateValue}
          disabled={!stateValue}
        />
      </div>
    </div>
  );
}
