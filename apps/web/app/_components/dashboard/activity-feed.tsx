'use client';

import { useCallback } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  Activity,
  Building2,
  CheckCircle,
  CreditCard,
  Gift,
  ShoppingBag,
  Store,
  UserMinus,
  UserPlus,
  XCircle,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import { Database } from '~/lib/database.types';

type ActivityType = Database['public']['Enums']['activity_type'];

export interface ActivityItem {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface ActivityFeedProps {
  title: string;
  activities: ActivityItem[];
  pagination: {
    page: number;
    totalPages: number;
  };
  basePath?: string;
}

const activityIcons: Record<ActivityType, React.ElementType> = {
  organization_onboarded: Building2,
  organization_deactivated: Building2,
  merchant_added: Store,
  discount_created: Gift,
  discount_updated: Gift,
  payment_failed: XCircle,
  card_sold: CreditCard,
  card_activated: CheckCircle,
  distributor_added: UserPlus,
  distributor_deactivated: UserMinus,
  batch_assigned: ShoppingBag,
  sale_completed: CreditCard,
  redemption_completed: Gift,
};

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function ActivityItemRow({ activity }: { activity: ActivityItem }) {
  const Icon = activityIcons[activity.type] || Activity;

  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
        <Icon className="text-muted-foreground h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm leading-tight">{activity.message}</p>
        <p className="text-muted-foreground text-xs">
          {formatTimestamp(activity.timestamp)}
        </p>
      </div>
    </div>
  );
}

export function ActivityFeed({
  title,
  activities,
  pagination,
  basePath = '',
}: ActivityFeedProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(newPage));
      router.push(`${basePath}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, basePath],
  );

  return (
    <Card>
      <CardHeader className="bg-muted flex flex-row items-center gap-3 rounded-t-lg p-3">
        <Activity className="text-muted-foreground h-4 w-4" />
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No recent activities
          </p>
        ) : (
          <div className="divide-y">
            {activities.map((activity) => (
              <ActivityItemRow key={activity.id} activity={activity} />
            ))}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-2">
            {Array.from({ length: Math.min(pagination.totalPages, 3) }).map(
              (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={
                      pagination.page === pageNum ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              },
            )}
            {pagination.totalPages > 3 && (
              <span className="text-muted-foreground px-2">...</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
