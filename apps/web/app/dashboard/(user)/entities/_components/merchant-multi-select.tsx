'use client';

import { useMemo, useState } from 'react';

import { Check, ChevronsUpDown, X } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
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

export interface MerchantOption {
  id: string;
  name: string;
  city?: string | null;
}

interface MerchantMultiSelectProps {
  merchants: MerchantOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MerchantMultiSelect({
  merchants,
  value,
  onValueChange,
  placeholder = 'Select merchants...',
  disabled = false,
}: MerchantMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMerchants = useMemo(() => {
    if (!searchQuery) return merchants;

    const query = searchQuery.toLowerCase();
    return merchants.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        (m.city && m.city.toLowerCase().includes(query)),
    );
  }, [merchants, searchQuery]);

  const selectedMerchants = useMemo(() => {
    return merchants.filter((m) => value.includes(m.id));
  }, [merchants, value]);

  const toggleMerchant = (merchantId: string) => {
    const newValue = value.includes(merchantId)
      ? value.filter((id) => id !== merchantId)
      : [...value, merchantId];
    onValueChange(newValue);
  };

  const removeMerchant = (merchantId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onValueChange(value.filter((id) => id !== merchantId));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'border-input bg-background ring-offset-background flex min-h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm',
            'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          disabled={disabled}
          data-test="merchant-multi-select-trigger"
        >
          <div className="flex flex-1 flex-wrap items-center gap-1">
            {selectedMerchants.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedMerchants.map((merchant) => (
                <Badge
                  key={merchant.id}
                  variant="secondary"
                  className="gap-1 py-0.5 pr-1 text-xs"
                  data-test={`selected-merchant-${merchant.id}`}
                >
                  {merchant.name}
                  <span
                    role="button"
                    tabIndex={0}
                    className="hover:bg-muted rounded-full p-0.5"
                    onClick={(e) => removeMerchant(merchant.id, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onValueChange(value.filter((id) => id !== merchant.id));
                      }
                    }}
                    aria-label={`Remove ${merchant.name}`}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search merchants..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            data-test="merchant-search-input"
          />
          <CommandList>
            <CommandEmpty>No merchant found.</CommandEmpty>
            <CommandGroup>
              {filteredMerchants.map((merchant) => {
                const isSelected = value.includes(merchant.id);
                return (
                  <CommandItem
                    key={merchant.id}
                    value={merchant.id}
                    onSelect={() => toggleMerchant(merchant.id)}
                    data-test={`merchant-option-${merchant.id}`}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{merchant.name}</span>
                      {merchant.city && (
                        <span className="text-muted-foreground text-xs">
                          {merchant.city}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
