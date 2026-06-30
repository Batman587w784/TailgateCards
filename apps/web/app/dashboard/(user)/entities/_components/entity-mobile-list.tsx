'use client';

import { useCallback } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { MoreHorizontal } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

interface EntityMobileListProps<T> {
  data: T[];
  pageCount: number;
  currentPage: number;
  title: string;
  titleIcon?: React.ReactNode;
  renderTile: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
}

export function EntityMobileList<T>({
  data,
  pageCount,
  currentPage,
  title,
  titleIcon,
  renderTile,
  emptyMessage = 'No items found',
  keyExtractor,
}: EntityMobileListProps<T>) {
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
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-lg border">
      <div className="bg-muted flex items-center gap-2 rounded-t-lg px-4 py-3">
        {titleIcon}
        <span className="text-muted-foreground text-sm font-medium">
          {title}
        </span>
      </div>

      <div className="flex flex-col divide-y">
        {data.map((item, index) => (
          <div key={keyExtractor(item)} className="p-4">
            {renderTile(item, index)}
          </div>
        ))}
      </div>

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
