import { Progress } from '@kit/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import { formatUsdFromCents } from '~/lib/currency';

import { type DistrictDashboardData } from '../../_lib/server/district-dashboard.loader';

function pct(p: number | null | undefined) {
  return Math.min(100, Math.max(0, Math.round((p ?? 0) * 100)));
}

/**
 * District (campus) admin overview — READ-ONLY on money (ledger #24). The
 * per-card nonprofit rate is super-admin-only and not shown/edited here; the
 * district sees its chapters, cards sold, raised-for-cause, and district goal.
 */
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
            Cards sold and the amount raised for the cause by each chapter.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chapter</TableHead>
                <TableHead className="text-right">Cards sold</TableHead>
                <TableHead className="text-right">Raised for cause</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orgs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-muted-foreground text-center"
                  >
                    No active chapters in this district yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.orgs.map((org) => (
                  <TableRow key={org.org_account_id}>
                    <TableCell className="font-medium">
                      {org.organization_name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {org.cards_sold}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsdFromCents(org.cause_raised_cents)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
