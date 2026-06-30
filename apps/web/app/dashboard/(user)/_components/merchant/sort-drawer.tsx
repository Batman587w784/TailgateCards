'use client';

import { usePathname, useRouter } from 'next/navigation';

import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { Trans } from '@kit/ui/trans';

interface SortDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSortOrder: 'asc' | 'desc';
}

export function SortDrawer({
  open,
  onOpenChange,
  currentSortOrder,
}: SortDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('sortBy', 'redeemed_at');
    params.set('sortOrder', value);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>
            <Trans i18nKey="merchant:sort.title" defaults="Sort by" />
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>
              <Trans i18nKey="merchant:sort.date" defaults="Date" />
            </Label>
            <Select value={currentSortOrder} onValueChange={handleSortChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">
                  <Trans
                    i18nKey="merchant:sort.newestFirst"
                    defaults="Newest to Oldest"
                  />
                </SelectItem>
                <SelectItem value="asc">
                  <Trans
                    i18nKey="merchant:sort.oldestFirst"
                    defaults="Oldest to Newest"
                  />
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
