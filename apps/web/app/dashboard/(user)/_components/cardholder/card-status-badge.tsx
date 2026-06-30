import { Badge } from '@kit/ui/badge';

import { CardholderCard } from '../../_lib/server/cardholder-page.loader';

interface CardStatusBadgeProps {
  card: CardholderCard | null;
}

export function CardStatusBadge({ card }: CardStatusBadgeProps) {
  const isActive = card?.status === 'activated';
  const statusText = isActive ? 'Active' : 'Inactive';

  return (
    <div className="flex items-center gap-x-2">
      <span className="text-muted-foreground text-sm">Card Status</span>
      <Badge
        className={
          isActive
            ? 'border-transparent bg-green-500 text-white'
            : 'bg-destructive border-transparent text-white'
        }
      >
        {statusText}
      </Badge>
    </div>
  );
}
