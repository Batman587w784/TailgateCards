import { Calendar, Ticket } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import { CardholderStats } from '../../_lib/server/cardholder-page.loader';

interface StatsCardsProps {
  stats: CardholderStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <StatCard
        title="Discounts Used"
        value={stats.discountsUsed.toString()}
        icon={<Ticket className="h-4 w-4 text-blue-600" />}
        description="Total redemptions made"
      />
      <StatCard
        title="Days Remaining"
        value={stats.daysRemaining.toString()}
        icon={<Calendar className="h-4 w-4 text-orange-600" />}
        description="Until card expires"
      />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
}

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-muted-foreground text-xs">{description}</p>
      </CardContent>
    </Card>
  );
}
