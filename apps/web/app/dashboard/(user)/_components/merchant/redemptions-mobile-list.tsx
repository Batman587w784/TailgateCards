'use client';

import { useCallback } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { CreditCard, LayoutGrid, MoreHorizontal } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import type { RedemptionRecord } from '../../_lib/server/merchant-page.loader';

interface RedemptionsMobileListProps {
  data: RedemptionRecord[];
  pageCount: number;
  currentPage: number;
}

export function RedemptionsMobileList({
  data,
  pageCount,
  currentPage,
}: RedemptionsMobileListProps) {
  const router = useRouter();
  const pathname = usePathname();

  const navigateToPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(window.location.search);
      params.set('page', String(newPage));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  const getPageNumbers = useCallback(() => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 3;

    if (pageCount <= maxVisiblePages + 2) {
      for (let i = 1; i <= pageCount; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(pageCount - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < pageCount - 2) {
        pages.push('ellipsis');
      }

      if (!pages.includes(pageCount)) {
        pages.push(pageCount);
      }
    }

    return pages;
  }, [pageCount, currentPage]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">
          <Trans
            i18nKey="merchant:table.noRedemptions"
            defaults="No redemptions found"
          />
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8 flex flex-col rounded-lg border">
      {/* Top bar with muted background */}
      <div className="bg-muted flex items-center gap-2 rounded-t-lg px-4 py-3">
        <LayoutGrid className="text-muted-foreground h-4 w-4" />
        <span className="text-muted-foreground text-sm font-medium">
          <Trans i18nKey="merchant:recentScans.title" defaults="Recent Scans" />
        </span>
      </div>

      {/* Mobile tile list with 16px padding */}
      <div className="flex flex-col divide-y p-4">
        {data.map((item) => {
          const date = new Date(item.redeemed_at);
          return (
            <div
              key={item.id}
              className="flex items-start justify-between py-4 first:pt-0 last:pb-0"
            >
              {/* Left side */}
              <div className="flex flex-col gap-1">
                <span className="text-brand font-medium">
                  #{item.card_code} - {item.discount_title}
                </span>
                <span className="text-muted-foreground text-sm">
                  <CreditCard className="mr-1 inline-block h-4 w-4" />
                  Card ID: {item.card_code}
                </span>
              </div>

              {/* Right side */}
              <div className="text-muted-foreground flex flex-col items-end text-sm">
                <span>
                  {date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </span>
                <span>
                  {date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-end border-t px-4 py-3">
          <div className="flex items-center gap-1">
            {getPageNumbers().map((pageNum, index) =>
              pageNum === 'ellipsis' ? (
                <Button
                  key={`ellipsis-${index}`}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? 'outline' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-8 w-8 p-0',
                    pageNum === currentPage && 'border-border',
                  )}
                  onClick={() => navigateToPage(pageNum)}
                >
                  {pageNum}
                </Button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
