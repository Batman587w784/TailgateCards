'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import {
  DiscountWithMerchant,
  RedeemedDiscount,
} from '../../_lib/server/cardholder-page.loader';
import { DiscountCard } from './discount-card';
import { RedeemedDiscountCard } from './redeemed-discount-card';

interface DiscountsTabsProps {
  discounts: {
    active: DiscountWithMerchant[];
    expired: DiscountWithMerchant[];
    redeemed: RedeemedDiscount[];
  };
}

export function DiscountsTabs({ discounts }: DiscountsTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = searchParams.get('tab') || 'active';

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="active">
          Active ({discounts.active.length})
        </TabsTrigger>
        <TabsTrigger value="expired">
          Expired ({discounts.expired.length})
        </TabsTrigger>
        <TabsTrigger value="redeemed">
          Redeemed ({discounts.redeemed.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="mt-6">
        <DiscountGrid
          discounts={discounts.active}
          emptyMessage="No active discounts available"
        />
      </TabsContent>

      <TabsContent value="expired" className="mt-6">
        <DiscountGrid
          discounts={discounts.expired}
          emptyMessage="No expired discounts"
        />
      </TabsContent>

      <TabsContent value="redeemed" className="mt-6">
        <RedeemedGrid
          discounts={discounts.redeemed}
          emptyMessage="No discounts redeemed yet"
        />
      </TabsContent>
    </Tabs>
  );
}

interface DiscountGridProps {
  discounts: DiscountWithMerchant[];
  emptyMessage: string;
}

function DiscountGrid({ discounts, emptyMessage }: DiscountGridProps) {
  if (discounts.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {discounts.map((discount) => (
        <DiscountCard key={discount.id} discount={discount} />
      ))}
    </div>
  );
}

interface RedeemedGridProps {
  discounts: RedeemedDiscount[];
  emptyMessage: string;
}

function RedeemedGrid({ discounts, emptyMessage }: RedeemedGridProps) {
  if (discounts.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {discounts.map((discount) => (
        <RedeemedDiscountCard key={discount.id} discount={discount} />
      ))}
    </div>
  );
}
