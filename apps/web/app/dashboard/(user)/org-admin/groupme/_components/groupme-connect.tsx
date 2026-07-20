'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { MessageSquare } from 'lucide-react';

import { Alert, AlertDescription } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import type { GroupMeStatus } from '../_lib/server/groupme-page.loader';
import {
  disconnectAction,
  toggleWeeklyAction,
} from '../_lib/server/groupme-server-actions';

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'GroupMe isn’t set up yet. Please contact support.',
  csrf: 'That connect link expired. Please try again.',
  expired: 'That connect link expired. Please try again.',
  no_token: 'GroupMe didn’t grant access. Please try again.',
  no_org: 'We couldn’t find your chapter. Please try again.',
  not_org_admin: 'Only a chapter admin can connect GroupMe.',
  store_failed: 'Something went wrong connecting. Please try again.',
  connect_failed: 'Something went wrong connecting. Please try again.',
};

function ConnectedState({ status }: { status: GroupMeStatus }) {
  const router = useRouter();
  const [weekly, setWeekly] = useState(status.weekly_enabled);
  const [isPending, startTransition] = useTransition();

  function onToggle(next: boolean) {
    setWeekly(next);
    startTransition(async () => {
      const res = await toggleWeeklyAction({ enabled: next });
      if (res?.success) {
        toast.success(next ? 'Weekly drops on.' : 'Weekly drops paused.');
      } else {
        setWeekly(!next);
        toast.error('Could not update. Please try again.');
      }
      router.refresh();
    });
  }

  function onDisconnect() {
    if (!window.confirm('Disconnect GroupMe? Standings will stop posting.')) {
      return;
    }
    startTransition(async () => {
      const res = await disconnectAction({});
      if (res?.success) {
        toast.success('GroupMe disconnected.');
      } else {
        toast.error('Could not disconnect. Please try again.');
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-sm">
        Connected to{' '}
        <span className="font-medium">{status.group_name ?? 'your group'}</span>
        .
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Weekly standings drop</p>
          <p className="text-muted-foreground text-xs">
            Posts the leaderboard, prize progress, and countdown — more often in
            the final stretch.
          </p>
        </div>
        <Switch
          checked={weekly}
          disabled={isPending}
          onCheckedChange={onToggle}
        />
      </div>

      <Button variant="outline" disabled={isPending} onClick={onDisconnect}>
        Disconnect
      </Button>
    </div>
  );
}

export function GroupMeConnect({
  status,
  error,
}: {
  status: GroupMeStatus;
  error?: string;
}) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          GroupMe
        </CardTitle>
        <CardDescription>
          Auto-post your chapter’s standings to your GroupMe group.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {ERROR_MESSAGES[error] ??
                'Something went wrong. Please try again.'}
            </AlertDescription>
          </Alert>
        ) : null}

        {status.connected ? (
          <ConnectedState status={status} />
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Connect once and Tailgate posts a weekly standings update — no
              copy-pasting. You can pause or disconnect anytime.
            </p>
            <Button asChild>
              <a href="/api/groupme/connect">Connect GroupMe</a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
