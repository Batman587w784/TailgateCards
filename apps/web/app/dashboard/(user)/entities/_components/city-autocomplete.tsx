'use client';

import { useMemo, useState } from 'react';

import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@kit/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { cn } from '@kit/ui/utils';

import usCities from '~/lib/data/us-cities.json';
import usStatesCities from '~/lib/data/us-states-cities.json';

interface CityAutocompleteProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  state?: string;
}

export function CityAutocomplete({
  value,
  onValueChange,
  placeholder = 'Select city...',
  disabled = false,
  state,
}: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get cities based on state filter or use all cities
  const availableCities = useMemo(() => {
    if (state && state in usStatesCities) {
      return usStatesCities[state as keyof typeof usStatesCities];
    }
    return usCities;
  }, [state]);

  // Filter cities based on search query (limit to 50 for performance)
  const filteredCities = useMemo(() => {
    if (!searchQuery) return availableCities.slice(0, 50);

    const query = searchQuery.toLowerCase();
    return availableCities
      .filter((city) => city.toLowerCase().includes(query))
      .slice(0, 50);
  }, [searchQuery, availableCities]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
          data-test="city-autocomplete-trigger"
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search cities..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            data-test="city-search-input"
          />
          <CommandList>
            <CommandEmpty>No city found.</CommandEmpty>
            <CommandGroup>
              {filteredCities.map((city) => (
                <CommandItem
                  key={city}
                  value={city}
                  onSelect={() => {
                    const newValue = city === value ? '' : city;
                    onValueChange(newValue);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                  data-test={`city-option-${city.toLowerCase().replace(/\s/g, '-')}`}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === city ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {city}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
