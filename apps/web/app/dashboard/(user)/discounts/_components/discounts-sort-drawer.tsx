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

interface DiscountsSortDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSortBy?: string;
  currentSortOrder: 'asc' | 'desc';
}

export function DiscountsSortDrawer({
  open,
  onOpenChange,
  currentSortBy,
  currentSortOrder,
}: DiscountsSortDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleNameOrderChange = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('sortBy', 'title');
    params.set('sortOrder', value);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleDateOrderChange = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('sortBy', 'created_at');
    params.set('sortOrder', value);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleRedemptionsOrderChange = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('sortBy', 'redemption_count');
    params.set('sortOrder', value);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleStatusOrderChange = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('sortBy', 'is_active');
    params.set('sortOrder', value);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
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
            defaultValue={['name', 'date']}
            className="w-full"
          >
            {/* Name Section */}
            <AccordionItem value="name" className="border-b-0">
              <AccordionTrigger className="bg-muted/50 hover:bg-muted rounded-lg px-4 py-3 hover:no-underline">
                Name
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-3">
                <RadioGroup
                  value={
                    currentSortBy === 'title' ? currentSortOrder : undefined
                  }
                  onValueChange={handleNameOrderChange}
                  className="gap-3"
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="asc" id="name-az" />
                    <Label htmlFor="name-az" className="cursor-pointer">
                      A to Z
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="desc" id="name-za" />
                    <Label htmlFor="name-za" className="cursor-pointer">
                      Z to A
                    </Label>
                  </div>
                </RadioGroup>
              </AccordionContent>
            </AccordionItem>

            {/* Date Section */}
            <AccordionItem value="date" className="border-b-0">
              <AccordionTrigger className="bg-muted/50 hover:bg-muted mt-2 rounded-lg px-4 py-3 hover:no-underline">
                Created Date
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-3">
                <RadioGroup
                  value={
                    currentSortBy === 'created_at'
                      ? currentSortOrder
                      : undefined
                  }
                  onValueChange={handleDateOrderChange}
                  className="gap-3"
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="desc" id="date-newest" />
                    <Label htmlFor="date-newest" className="cursor-pointer">
                      Newest to Oldest
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="asc" id="date-oldest" />
                    <Label htmlFor="date-oldest" className="cursor-pointer">
                      Oldest to Newest
                    </Label>
                  </div>
                </RadioGroup>
              </AccordionContent>
            </AccordionItem>

            {/* Redemptions Section */}
            <AccordionItem value="redemptions" className="border-b-0">
              <AccordionTrigger className="bg-muted/50 hover:bg-muted mt-2 rounded-lg px-4 py-3 hover:no-underline">
                Redemptions
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-3">
                <RadioGroup
                  value={
                    currentSortBy === 'redemption_count'
                      ? currentSortOrder
                      : undefined
                  }
                  onValueChange={handleRedemptionsOrderChange}
                  className="gap-3"
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="desc" id="redemptions-high" />
                    <Label
                      htmlFor="redemptions-high"
                      className="cursor-pointer"
                    >
                      Highest to Lowest
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="asc" id="redemptions-low" />
                    <Label htmlFor="redemptions-low" className="cursor-pointer">
                      Lowest to Highest
                    </Label>
                  </div>
                </RadioGroup>
              </AccordionContent>
            </AccordionItem>

            {/* Status Section */}
            <AccordionItem value="status" className="border-b-0">
              <AccordionTrigger className="bg-muted/50 hover:bg-muted mt-2 rounded-lg px-4 py-3 hover:no-underline">
                Status
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-3">
                <RadioGroup
                  value={
                    currentSortBy === 'is_active' ? currentSortOrder : undefined
                  }
                  onValueChange={handleStatusOrderChange}
                  className="gap-3"
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="desc" id="status-activated" />
                    <Label
                      htmlFor="status-activated"
                      className="cursor-pointer"
                    >
                      Activated to Deactivated
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="asc" id="status-deactivated" />
                    <Label
                      htmlFor="status-deactivated"
                      className="cursor-pointer"
                    >
                      Deactivated to Activated
                    </Label>
                  </div>
                </RadioGroup>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  );
}
