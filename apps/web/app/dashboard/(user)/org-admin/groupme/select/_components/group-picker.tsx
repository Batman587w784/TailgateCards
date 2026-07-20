'use client';

import { useRouter } from 'next/navigation';

import { useState } from 'react';

import { Users } from 'lucide-react';

import { Spinner } from '@kit/ui/spinner';
import { toast } from '@kit/ui/sonner';

import type { GroupMeGroup } from '~/lib/server/groupme-api';

import { selectGroupAction } from '../../_lib/server/groupme-server-actions';

const MANAGE_PATH = '/dashboard/org-admin/groupme';

export function GroupPicker({ groups }: { groups: GroupMeGroup[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function choose(group: GroupMeGroup) {
    setPendingId(group.id);
    try {
      const res = await selectGroupAction({
        groupId: group.id,
        groupName: group.name,
      });

      if (res?.success) {
        toast.success(`Connected to ${group.name} — first standings posted.`);
        router.push(MANAGE_PATH);
        return;
      }

      toast.error('Could not connect that group. Please try again.');
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setPendingId(null);
  }

  if (!groups.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No GroupMe groups were found on your account. Create or join a group in
        GroupMe first, then reconnect.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          disabled={pendingId !== null}
          onClick={() => choose(group)}
          className="hover:bg-muted flex items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-50"
        >
          {group.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.image_url}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <Users className="h-5 w-5" />
            </div>
          )}
          <span className="flex-1 font-medium">{group.name}</span>
          {pendingId === group.id ? <Spinner className="h-4 w-4" /> : null}
        </button>
      ))}
    </div>
  );
}
