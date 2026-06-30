'use client';

import { useEffect, useRef, useTransition } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpDown, Search } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@kit/ui/button';
import { Form, FormControl, FormField, FormItem } from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

const SearchSchema = z.object({
  query: z.string().optional(),
});

interface EntityMobileControlsProps {
  searchPlaceholder?: string;
  searchQuery?: string;
  onSortClick: () => void;
  filterButton?: React.ReactNode;
}

export function EntityMobileControls({
  searchPlaceholder = 'Search...',
  searchQuery = '',
  onSortClick,
  filterButton,
}: EntityMobileControlsProps) {
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
    <div className="grid grid-cols-2 gap-2 sm:hidden">
      {/* Search */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
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
                      data-test="entity-mobile-search-input"
                      className="w-full pl-9"
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

      {/* Sort by */}
      <Button variant="outline" onClick={onSortClick} className="w-full gap-2">
        <ArrowUpDown className="h-4 w-4" />
        Sort by
      </Button>

      {/* Filter button if provided */}
      {filterButton && <div className="col-span-2 w-full">{filterButton}</div>}
    </div>
  );
}
