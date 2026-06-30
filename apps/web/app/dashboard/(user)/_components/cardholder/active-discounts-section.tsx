'use client';

import { useMemo, useState } from 'react';

import { Search } from 'lucide-react';

import { Input } from '@kit/ui/input';

import { ActiveDiscountWithUsage } from '../../_lib/server/cardholder-page.loader';
import { ActiveDiscountCard } from './active-discount-card';

interface ActiveDiscountsSectionProps {
  discounts: ActiveDiscountWithUsage[];
}

export function ActiveDiscountsSection({
  discounts,
}: ActiveDiscountsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDiscounts = useMemo(() => {
    if (!searchQuery.trim()) {
      return discounts;
    }

    const query = searchQuery.toLowerCase();
    return discounts.filter(
      (discount) =>
        discount.title.toLowerCase().includes(query) ||
        discount.merchant.business_name.toLowerCase().includes(query),
    );
  }, [discounts, searchQuery]);

  return (
    <div
      className="overflow-hidden sm:rounded-lg sm:border"
      style={{ boxShadow: '0px 1px 2px 0px #0000000D' }}
    >
      {/* Mobile: Search only */}
      <div className="relative mb-4 sm:hidden">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          type="text"
          placeholder="Search discounts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Desktop: Header Bar */}
      <div className="bg-brand hidden items-center justify-between gap-4 px-4 py-3 sm:flex">
        <h2 className="text-lg font-semibold text-white">Active Discounts</h2>

        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search discounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 bg-white pl-9"
          />
        </div>
      </div>

      {/* Discounts Grid */}
      <div className="bg-background sm:p-4">
        {filteredDiscounts.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {filteredDiscounts.map((discount) => (
              <ActiveDiscountCard key={discount.id} discount={discount} />
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">
            {searchQuery
              ? 'No discounts match your search.'
              : 'No active discounts available.'}
          </div>
        )}
      </div>
    </div>
  );
}
