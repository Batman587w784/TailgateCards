'use client';

import { useState } from 'react';

import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Calendar } from '@kit/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { cn } from '@kit/ui/utils';

interface DateRangeFilterProps {
  label: string;
  fromDate: string | null;
  toDate: string | null;
  onFromChange: (date: string | null) => void;
  onToChange: (date: string | null) => void;
}

export function DateRangeFilter({
  label,
  fromDate,
  toDate,
  onFromChange,
  onToChange,
}: DateRangeFilterProps) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const fromDateObj = fromDate ? new Date(fromDate) : undefined;
  const toDateObj = toDate ? new Date(toDate) : undefined;

  const handleFromSelect = (date: Date | undefined) => {
    if (date) {
      onFromChange(format(date, 'yyyy-MM-dd'));
      setFromOpen(false);
      setToOpen(true);
    } else {
      onFromChange(null);
    }
  };

  const handleToSelect = (date: Date | undefined) => {
    if (date) {
      onToChange(format(date, 'yyyy-MM-dd'));
      setToOpen(false);
    } else {
      onToChange(null);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <DatePicker
          placeholder="From"
          selected={fromDateObj}
          onSelect={handleFromSelect}
          toDate={toDateObj}
          open={fromOpen}
          onOpenChange={setFromOpen}
        />
        <DatePicker
          placeholder="To"
          selected={toDateObj}
          onSelect={handleToSelect}
          fromDate={fromDateObj}
          open={toOpen}
          onOpenChange={setToOpen}
        />
      </div>
    </div>
  );
}

interface DatePickerProps {
  placeholder: string;
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  fromDate?: Date;
  toDate?: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DatePicker({
  placeholder,
  selected,
  onSelect,
  fromDate,
  toDate,
  open,
  onOpenChange,
}: DatePickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {selected ? format(selected, 'MMM d, yyyy') : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          defaultMonth={selected ?? fromDate ?? toDate}
          selected={selected}
          onSelect={onSelect}
          disabled={(date) => {
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            if (date > today) return true;
            if (fromDate && date < fromDate) return true;
            if (toDate && date > toDate) return true;
            return false;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
