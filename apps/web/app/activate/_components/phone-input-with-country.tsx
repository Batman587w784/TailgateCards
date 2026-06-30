'use client';

import { forwardRef, useState } from 'react';

import { ChevronDown } from 'lucide-react';

import { cn } from '@kit/ui/utils';

interface CountryCode {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

const DEFAULT_COUNTRY: CountryCode = {
  code: 'US',
  dialCode: '+1',
  flag: '🇺🇸',
  name: 'United States',
};

const COUNTRY_CODES: CountryCode[] = [
  DEFAULT_COUNTRY,
  { code: 'CA', dialCode: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: 'GB', dialCode: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'AU', dialCode: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: 'DE', dialCode: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', dialCode: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'ES', dialCode: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: 'IT', dialCode: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: 'MX', dialCode: '+52', flag: '🇲🇽', name: 'Mexico' },
  { code: 'BR', dialCode: '+55', flag: '🇧🇷', name: 'Brazil' },
];

interface PhoneInputWithCountryProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'data-test'?: string;
}

export const PhoneInputWithCountry = forwardRef<
  HTMLInputElement,
  PhoneInputWithCountryProps
>(function PhoneInputWithCountry(
  {
    value = '',
    onChange,
    onBlur,
    name,
    placeholder = '(555) 123-4567',
    disabled,
    className,
    'data-test': dataTest,
  },
  ref,
) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse the value to extract country code and number
  const parseValue = (
    val: string,
  ): { country: CountryCode; number: string } => {
    for (const country of COUNTRY_CODES) {
      if (val.startsWith(country.dialCode)) {
        return {
          country,
          number: val.slice(country.dialCode.length).trim(),
        };
      }
    }
    return { country: DEFAULT_COUNTRY, number: val };
  };

  const { country: selectedCountry, number: phoneNumber } = parseValue(value);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  };

  const handleCountryChange = (country: CountryCode) => {
    setIsOpen(false);
    // Update value with new country code
    onChange?.(`${country.dialCode} ${phoneNumber}`.trim());
  };

  const formatPhoneNumber = (input: string) => {
    // Remove all non-digit characters
    const digits = input.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX for US/CA numbers
    if (selectedCountry.code === 'US' || selectedCountry.code === 'CA') {
      if (digits.length <= 3) {
        return digits;
      }
      if (digits.length <= 6) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      }
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }

    return input;
  };

  const handleFormattedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    onChange?.(`${selectedCountry.dialCode} ${formatted}`.trim());
  };

  return (
    <div className={cn('relative flex', className)}>
      {/* Country selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            'border-input flex h-10 items-center gap-1 rounded-l-md border border-r-0 bg-slate-50 px-3 text-sm',
            'focus:ring-ring hover:bg-slate-100 focus:ring-2 focus:ring-offset-2 focus:outline-none',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          aria-label="Select country code"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="text-base">{selectedCountry.flag}</span>
          <span className="text-muted-foreground text-xs">
            {selectedCountry.dialCode}
          </span>
          <ChevronDown className="text-muted-foreground h-3 w-3" />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div
            className="absolute top-full left-0 z-50 mt-1 max-h-60 w-56 overflow-auto rounded-md border bg-white shadow-lg"
            role="listbox"
          >
            {COUNTRY_CODES.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => handleCountryChange(country)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100',
                  selectedCountry.code === country.code && 'bg-slate-50',
                )}
                role="option"
                aria-selected={selectedCountry.code === country.code}
              >
                <span className="text-base">{country.flag}</span>
                <span className="flex-1">{country.name}</span>
                <span className="text-muted-foreground text-xs">
                  {country.dialCode}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Phone number input */}
      <input
        ref={ref}
        type="tel"
        name={name}
        value={phoneNumber}
        onChange={handleFormattedChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        data-test={dataTest}
        className={cn(
          'border-input bg-background flex h-10 w-full rounded-r-md border px-3 py-2 text-sm',
          'placeholder:text-muted-foreground',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        autoComplete="tel-national"
        aria-label="Phone number"
      />

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
});
