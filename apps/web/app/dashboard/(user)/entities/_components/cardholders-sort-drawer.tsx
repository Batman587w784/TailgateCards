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

interface CardholdersSortDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSortBy: string;
  currentSortOrder: 'asc' | 'desc';
}

export function CardholdersSortDrawer({
  open,
  onOpenChange,
  currentSortBy,
  currentSortOrder,
}: CardholdersSortDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleExpiryDateOrderChange = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('sortBy', 'expiry_date');
    params.set('sortOrder', value);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleActivationDateOrderChange = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('sortBy', 'activation_date');
    params.set('sortOrder', value);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleUseCountOrderChange = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('sortBy', 'total_redemptions');
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
            defaultValue={['expiry_date', 'activation_date']}
            className="w-full"
          >
            {/* Expiry Date Section */}
            <AccordionItem value="expiry_date" className="border-b-0">
              <AccordionTrigger className="bg-muted/50 hover:bg-muted rounded-lg px-4 py-3 hover:no-underline">
                Expiry Date
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-3">
                <RadioGroup
                  value={
                    currentSortBy === 'expiry_date'
                      ? currentSortOrder
                      : undefined
                  }
                  onValueChange={handleExpiryDateOrderChange}
                  className="gap-3"
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="asc" id="expiry-soonest" />
                    <Label htmlFor="expiry-soonest" className="cursor-pointer">
                      Soonest to Latest
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="desc" id="expiry-latest" />
                    <Label htmlFor="expiry-latest" className="cursor-pointer">
                      Latest to Soonest
                    </Label>
                  </div>
                </RadioGroup>
              </AccordionContent>
            </AccordionItem>

            {/* Activation Date Section */}
            <AccordionItem value="activation_date" className="border-b-0">
              <AccordionTrigger className="bg-muted/50 hover:bg-muted mt-2 rounded-lg px-4 py-3 hover:no-underline">
                Activation Date
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-3">
                <RadioGroup
                  value={
                    currentSortBy === 'activation_date'
                      ? currentSortOrder
                      : undefined
                  }
                  onValueChange={handleActivationDateOrderChange}
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

            {/* Use Count Section */}
            <AccordionItem value="total_redemptions" className="border-b-0">
              <AccordionTrigger className="bg-muted/50 hover:bg-muted mt-2 rounded-lg px-4 py-3 hover:no-underline">
                Use Count
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-3">
                <RadioGroup
                  value={
                    currentSortBy === 'total_redemptions'
                      ? currentSortOrder
                      : undefined
                  }
                  onValueChange={handleUseCountOrderChange}
                  className="gap-3"
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="desc" id="use-high" />
                    <Label htmlFor="use-high" className="cursor-pointer">
                      Highest to Lowest
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="asc" id="use-low" />
                    <Label htmlFor="use-low" className="cursor-pointer">
                      Lowest to Highest
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
