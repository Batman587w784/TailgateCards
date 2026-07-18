'use client';

import { Minus, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';

interface QuantityStepperProps {
  value: number;
  max: number;
  min?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function QuantityStepper({
  value,
  max,
  min = 1,
  disabled = false,
  onChange,
}: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9"
        aria-label="Decrease quantity"
        data-test="quantity-decrease"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="h-4 w-4" />
      </Button>

      <span
        className="w-8 text-center text-lg font-semibold tabular-nums"
        aria-live="polite"
        data-test="quantity-value"
      >
        {value}
      </span>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9"
        aria-label="Increase quantity"
        data-test="quantity-increase"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
