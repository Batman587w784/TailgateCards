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

import usStatesCities from '~/lib/data/us-states-cities.json';

const US_STATES = Object.keys(usStatesCities);

interface StateAutocompleteProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function StateAutocomplete({
  value,
  onValueChange,
  placeholder = 'Select state...',
  disabled = false,
}: StateAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStates = useMemo(() => {
    if (!searchQuery) return US_STATES;

    const query = searchQuery.toLowerCase();
    return US_STATES.filter((state) => state.toLowerCase().includes(query));
  }, [searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
          data-test="state-autocomplete-trigger"
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search states..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            data-test="state-search-input"
          />
          <CommandList>
            <CommandEmpty>No state found.</CommandEmpty>
            <CommandGroup>
              {filteredStates.map((state) => (
                <CommandItem
                  key={state}
                  value={state}
                  onSelect={() => {
                    const newValue = state === value ? '' : state;
                    onValueChange(newValue);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                  data-test={`state-option-${state.toLowerCase().replace(/\s/g, '-')}`}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === state ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {state}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
