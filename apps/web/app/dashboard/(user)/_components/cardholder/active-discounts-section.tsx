'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { RefreshCw, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import { ActiveDiscountWithUsage } from '../../_lib/server/cardholder-page.loader';
import { ActiveDiscountCard } from './active-discount-card';

interface ActiveDiscountsSectionProps {
  discounts: ActiveDiscountWithUsage[];
  /** Ledger #22: when the card is expired, discounts stay visible but greyed. */
  isExpired?: boolean;
  /** Buy-a-new-card link for the same chapter; null if the org has no slug. */
  renewHref?: string | null;
}

export function ActiveDiscountsSection({
  discounts,
  isExpired = false,
  renewHref,
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

      {/* Ledger #22: expired card — discounts stay visible but greyed/disabled,
          with a Renew CTA (the best renewal-conversion moment). */}
      {isExpired && (
        <div className="flex flex-col gap-3 border-b bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:bg-amber-950/30">
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Your card has expired
            </p>
            <p className="text-sm text-amber-800/80 dark:text-amber-200/70">
              Renew to unlock these discounts again.
            </p>
          </div>
          {renewHref ? (
            <Button asChild size="sm" className="shrink-0">
              <Link href={renewHref}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Renew card
              </Link>
            </Button>
          ) : (
            // REVIEW: org has no buy-page slug, so we can't build a renew link.
            <Button size="sm" className="shrink-0" disabled>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Renew card
            </Button>
          )}
        </div>
      )}

      {/* Discounts Grid */}
      <div className="bg-background sm:p-4">
        {filteredDiscounts.length > 0 ? (
          <div
            className={cn(
              'grid grid-cols-2 gap-4 lg:grid-cols-3',
              isExpired && 'pointer-events-none opacity-50 grayscale',
            )}
            aria-disabled={isExpired}
          >
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
