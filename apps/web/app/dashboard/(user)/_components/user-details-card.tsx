import { Badge } from '@kit/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';

import { PlatformRole } from '../_lib/server/load-user-workspace';

interface UserDetailsCardProps {
  email: string;
  userId: string;
  platformRole: PlatformRole;
  isSuperAdmin: boolean;
}

const roleDisplayNames: Record<NonNullable<PlatformRole>, string> = {
  cardholder: 'Cardholder',
  org_admin: 'Organization Admin',
  distributor: 'Distributor',
  merchant: 'Merchant',
  district_admin: 'District Admin',
};

const roleVariants: Record<
  NonNullable<PlatformRole>,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  cardholder: 'default',
  org_admin: 'destructive',
  distributor: 'secondary',
  merchant: 'outline',
  district_admin: 'destructive',
};

export function UserDetailsCard({
  email,
  userId,
  platformRole,
  isSuperAdmin,
}: UserDetailsCardProps) {
  const displayRole = platformRole ? roleDisplayNames[platformRole] : 'Unknown';
  const variant = platformRole ? roleVariants[platformRole] : 'default';

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Details</CardTitle>
        <CardDescription>
          Your account information (for development)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Email</span>
            <span className="font-medium">{email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Platform Role</span>
            {isSuperAdmin ? (
              <Badge variant="destructive">Super Admin</Badge>
            ) : (
              <Badge variant={variant}>{displayRole}</Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">User ID</span>
            <span className="font-mono text-xs">{userId}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
