'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Progress } from '@kit/ui/progress';
import { toast } from '@kit/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import { formatUsdFromCents } from '~/lib/currency';

import {
  type DistrictCauseOrg,
  type DistrictDashboardData,
} from '../../_lib/server/district-dashboard.loader';
import { setOrgNonprofitAmount } from '../../_lib/server/district-dashboard-actions';

function pct(p: number | null | undefined) {
  return Math.min(100, Math.max(0, Math.round((p ?? 0) * 100)));
}

export function DistrictAdminDashboard({
  data,
}: {
  data: DistrictDashboardData;
}) {
  if (!data.districtId) {
    return (
      <div className="text-muted-foreground p-8 text-center text-sm">
        You aren&apos;t assigned to a district yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {data.summary ? (
        <div className="bg-sidebar flex flex-col gap-3 rounded-lg border p-5">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-lg font-bold">{data.summary.campus_name}</p>
              <p className="text-muted-foreground text-sm">
                {data.summary.total_cards_sold} cards sold
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Raised for the cause
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {formatUsdFromCents(data.summary.total_raised_cents)} of{' '}
                {formatUsdFromCents(data.summary.goal_target_cents)}
              </p>
            </div>
          </div>
          <Progress value={pct(data.summary.goal_progress)} className="h-2.5" />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Chapters</h2>
          <p className="text-muted-foreground text-xs">
            Set each chapter&apos;s nonprofit amount per card. The cause total
            above is cards sold × this amount.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chapter</TableHead>
                <TableHead className="text-right">Cards sold</TableHead>
                <TableHead className="text-right">Raised for cause</TableHead>
                <TableHead className="text-right">Nonprofit $/card</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orgs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-muted-foreground text-center"
                  >
                    No active chapters in this district yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.orgs.map((org) => <OrgRow key={org.org_account_id} org={org} />)
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function OrgRow({ org }: { org: DistrictCauseOrg }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dollars, setDollars] = useState(
    (org.nonprofit_cents_per_card / 100).toString(),
  );

  const dirty =
    Math.round(Number.parseFloat(dollars || '0') * 100) !==
    org.nonprofit_cents_per_card;

  const save = () => {
    const cents = Math.round(Number.parseFloat(dollars || '0') * 100);

    if (!Number.isFinite(cents) || cents < 0) {
      toast.error('Enter a valid amount');
      return;
    }

    startTransition(async () => {
      const res = await setOrgNonprofitAmount({
        orgAccountId: org.org_account_id,
        cents,
      });

      if (res.success) {
        toast.success('Saved');
        router.refresh();
      } else {
        toast.error('Could not save the amount');
      }
    });
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{org.organization_name}</TableCell>
      <TableCell className="text-right tabular-nums">{org.cards_sold}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatUsdFromCents(org.cause_raised_cents)}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <div className="relative w-24">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-sm">
              $
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={dollars}
              onChange={(e) => setDollars(e.target.value)}
              className="pl-5 text-right"
              data-test={`nonprofit-amount-${org.org_account_id}`}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!dirty || isPending}
            onClick={save}
          >
            Save
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
