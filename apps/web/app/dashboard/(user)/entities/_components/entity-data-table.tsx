'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, SortingState } from '@tanstack/react-table';
import { MoreHorizontal, Search } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/enhanced-data-table';
import { Form, FormControl, FormField, FormItem } from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import { EntityMobileControls } from './entity-mobile-controls';
import { EntitySortDrawer } from './entity-sort-drawer';

const SearchSchema = z.object({
  query: z.string().optional(),
});

type DataItem = Record<string, unknown>;

interface SortOption {
  value: string;
  label: string;
  orderType?: 'alpha' | 'date' | 'number' | 'status';
}

interface EntityDataTableProps<T extends DataItem> {
  data: T[];
  columns: ColumnDef<T>[];
  pageCount: number;
  pageSize: number;
  page: number;
  title: string;
  totalCount: number;
  searchPlaceholder?: string;
  searchQuery?: string;
  actionButton?: React.ReactNode;
  inlineFilters?: React.ReactNode;
  filterButton?: React.ReactNode;
  filterContent?: React.ReactNode;
  mobileFilterButton?: React.ReactNode;
  mobileFilterContent?: React.ReactNode;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  sortOptions?: SortOption[];
  mobileListComponent?: React.ReactNode;
  isLoading?: boolean;
}

export function EntityDataTable<T extends DataItem>({
  data,
  columns,
  pageCount,
  pageSize,
  page,
  title,
  totalCount,
  searchPlaceholder = 'Search...',
  searchQuery = '',
  actionButton,
  inlineFilters,
  filterButton,
  filterContent,
  mobileFilterButton,
  mobileFilterContent,
  sortBy,
  sortOrder,
  sortOptions,
  mobileListComponent,
  isLoading = false,
}: EntityDataTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const [sortDrawerOpen, setSortDrawerOpen] = useState(false);

  // Convert URL params to SortingState for the table
  const sorting: SortingState = useMemo(() => {
    if (sortBy) {
      return [{ id: sortBy, desc: sortOrder === 'desc' }];
    }
    return [];
  }, [sortBy, sortOrder]);

  // Handle sorting change from table
  const handleSortingChange = useCallback(
    (newSorting: SortingState) => {
      const params = new URLSearchParams(window.location.search);

      if (newSorting.length > 0) {
        const sort = newSorting[0];
        if (sort) {
          params.set('sortBy', sort.id);
          params.set('sortOrder', sort.desc ? 'desc' : 'asc');
        }
      } else {
        params.delete('sortBy');
        params.delete('sortOrder');
      }

      // Reset to page 1 when sorting changes
      params.set('page', '1');

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  return (
    <div className="flex flex-col">
      {/* Mobile action button - full width row above search/sort */}
      {actionButton && <div className="mb-2 sm:hidden">{actionButton}</div>}

      {/* Mobile controls - visible on mobile only */}
      {sortOptions && (
        <div className="mb-4 sm:hidden">
          <EntityMobileControls
            searchPlaceholder={searchPlaceholder}
            searchQuery={searchQuery}
            onSortClick={() => setSortDrawerOpen(true)}
            filterButton={mobileFilterButton}
          />
          <EntitySortDrawer
            open={sortDrawerOpen}
            onOpenChange={setSortDrawerOpen}
            currentSortBy={sortBy}
            currentSortOrder={sortOrder ?? 'desc'}
            sortOptions={sortOptions}
          />
        </div>
      )}

      {/* Mobile filter content - between controls and table */}
      {mobileFilterContent}

      {/* Desktop table card with shadow */}
      <div
        className="hidden rounded-lg sm:block"
        style={{
          boxShadow: '0px 1px 2px 0px #0000000D',
        }}
      >
        {/* Desktop header */}
        <div className="bg-muted flex items-center justify-between gap-4 rounded-t-lg border border-b-0 px-4 py-4">
          <span className="text-muted-foreground font-medium">{title}</span>
          <div className="flex items-center gap-3">
            {inlineFilters}
            <EntitySearchFilter
              searchPlaceholder={searchPlaceholder}
              searchQuery={searchQuery}
            />
            {filterButton}
            {actionButton}
          </div>
        </div>

        {/* Desktop filter content - full width row below header */}
        {filterContent && <div>{filterContent}</div>}

        {/* Table */}
        <div className="relative border border-b-0 bg-white p-4 pb-0">
          {isLoading && (
            <div className="bg-background/60 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]">
              <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          )}
          <div>
            <DataTable
              pageSize={pageSize}
              pageIndex={page - 1}
              data={data}
              columns={columns}
              sorting={sorting}
              onSortingChange={handleSortingChange}
              manualSorting={true}
            />
          </div>
        </div>

        {/* Desktop Pagination */}
        <EntityPagination
          page={page}
          pageCount={pageCount}
          totalCount={totalCount}
          title={title}
          dataLength={data.length}
        />
      </div>

      {/* Mobile list - visible on mobile only */}
      {mobileListComponent && (
        <div className="relative sm:hidden">
          {isLoading && (
            <div className="bg-background/60 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]">
              <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          )}
          {mobileListComponent}
        </div>
      )}
    </div>
  );
}

function EntitySearchFilter({
  searchPlaceholder,
  searchQuery,
}: {
  searchPlaceholder: string;
  searchQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const form = useForm({
    resolver: zodResolver(SearchSchema),
    defaultValues: {
      query: searchQuery,
    },
    mode: 'onChange',
  });

  const watchedQuery = useWatch({ control: form.control, name: 'query' });

  const navigateWithQuery = (query: string | undefined) => {
    const params = new URLSearchParams(window.location.search);

    if (query) {
      params.set('query', query);
    } else {
      params.delete('query');
    }

    params.set('page', '1');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (watchedQuery !== searchQuery) {
        navigateWithQuery(watchedQuery);
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedQuery]);

  const onSubmit = ({ query }: z.infer<typeof SearchSchema>) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    navigateWithQuery(query);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          name="query"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative">
                  <Search
                    className={cn(
                      'text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2',
                      isPending && 'animate-pulse',
                    )}
                  />
                  <Input
                    data-test="entity-table-search-input"
                    className="w-48 pl-9"
                    placeholder={searchPlaceholder}
                    {...field}
                  />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

export function EntityPagination({
  page,
  pageCount,
  totalCount,
  title,
  dataLength,
}: {
  page: number;
  pageCount: number;
  totalCount: number;
  title: string;
  dataLength: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const navigateToPage = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(newPage));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 3;

    if (pageCount <= maxVisiblePages + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= pageCount; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (page > 3) {
        pages.push('ellipsis');
      }

      // Show pages around current page
      const start = Math.max(2, page - 1);
      const end = Math.min(pageCount - 1, page + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (page < pageCount - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      if (!pages.includes(pageCount)) {
        pages.push(pageCount);
      }
    }

    return pages;
  };

  const showingCount = totalCount === 0 ? 0 : dataLength;

  return (
    <div className="flex items-center justify-between rounded-b-lg border bg-white px-4 py-3">
      <div className="text-muted-foreground text-sm">
        Showing{' '}
        <span className="text-foreground font-medium">
          {showingCount} of {totalCount}
        </span>{' '}
        {title.toLowerCase()}
      </div>

      {pageCount > 1 && (
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
                variant={pageNum === page ? 'outline' : 'ghost'}
                size="sm"
                className={cn(
                  'h-8 w-8 p-0',
                  pageNum === page && 'border-border',
                )}
                onClick={() => navigateToPage(pageNum)}
              >
                {pageNum}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
