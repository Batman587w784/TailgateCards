// Cadence for the weekly GroupMe drop, with a ramp in the final stretch of the
// competition window (#10). The cron runs daily and this decides, per connection,
// whether it's time to post again:
//   - final 48h (daysLeft <= 2): daily
//   - final week (daysLeft <= 7): every ~2 days
//   - otherwise / no active window: weekly
// Pure + deterministic so it can be unit-tested without a clock.
export function groupmeDropIntervalHours(daysLeft: number | null): number {
  if (daysLeft !== null && daysLeft <= 2) return 24;
  if (daysLeft !== null && daysLeft <= 7) return 48;
  return 168;
}

export function groupmeShouldPost(
  daysLeft: number | null,
  lastPostedAt: string | null,
  nowMs: number,
): boolean {
  // Never posted (e.g. weekly re-enabled with no history) → post now.
  if (!lastPostedAt) return true;

  const hoursSince = (nowMs - new Date(lastPostedAt).getTime()) / 3_600_000;
  // A fixed-time daily cron lands ~24h apart; a 6h grace stops a slightly-early
  // run from skipping a whole cycle (e.g. 23.5h < 24h would otherwise wait a day).
  const GRACE = 6;
  return hoursSince >= groupmeDropIntervalHours(daysLeft) - GRACE;
}
