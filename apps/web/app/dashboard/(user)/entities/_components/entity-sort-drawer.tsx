'use client';

import { usePathname, useRouter } from 'next/navigation';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@kit/ui/accordion';
import { Label } from '@kit/ui/label';
import { RadioGroup, RadioGroupItem } from '@kit/ui/radio-group';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';

type OrderType = 'alpha' | 'date' | 'number' | 'status';

interface SortOption {
  value: string;
  label: string;
  orderType?: OrderType;
}

interface EntitySortDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSortBy?: string;
  currentSortOrder: 'asc' | 'desc';
  sortOptions: SortOption[];
}

function getOrderLabels(orderType: OrderType = 'date'): {
  asc: string;
  desc: string;
} {
  switch (orderType) {
    case 'alpha':
      return { asc: 'A to Z', desc: 'Z to A' };
    case 'date':
      return { asc: 'Oldest to Newest', desc: 'Newest to Oldest' };
    case 'number':
      return { asc: 'Lowest to Highest', desc: 'Highest to Lowest' };
    case 'status':
      return { asc: 'Inactive to Active', desc: 'Active to Inactive' };
    default:
      return { asc: 'Ascending', desc: 'Descending' };
  }
}

export function EntitySortDrawer({
  open,
  onOpenChange,
  currentSortBy,
  currentSortOrder,
  sortOptions,
}: EntitySortDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSortChange = (sortBy: string, order: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('sortBy', sortBy);
    params.set('sortOrder', order);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Sort by</SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          <Accordion
            type="multiple"
            defaultValue={sortOptions.slice(0, 2).map((o) => o.value)}
            className="w-full"
          >
            {sortOptions.map((option, index) => {
              const orderLabels = getOrderLabels(option.orderType);
              return (
                <AccordionItem
                  key={option.value}
                  value={option.value}
                  className="border-b-0"
                >
                  <AccordionTrigger
                    className={`bg-muted/50 hover:bg-muted rounded-lg px-4 py-3 hover:no-underline ${
                      index > 0 ? 'mt-2' : ''
                    }`}
                  >
                    {option.label}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-3">
                    <RadioGroup
                      value={
                        currentSortBy === option.value
                          ? currentSortOrder
                          : undefined
                      }
                      onValueChange={(value) =>
                        handleSortChange(option.value, value)
                      }
                      className="gap-3"
                    >
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem
                          value="desc"
                          id={`${option.value}-desc`}
                        />
                        <Label
                          htmlFor={`${option.value}-desc`}
                          className="cursor-pointer"
                        >
                          {orderLabels.desc}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem
                          value="asc"
                          id={`${option.value}-asc`}
                        />
                        <Label
                          htmlFor={`${option.value}-asc`}
                          className="cursor-pointer"
                        >
                          {orderLabels.asc}
                        </Label>
                      </div>
                    </RadioGroup>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  );
}
