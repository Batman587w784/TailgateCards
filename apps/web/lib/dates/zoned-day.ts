import 'server-only';

import { cookies } from 'next/headers';

const TZ_COOKIE = 'user_tz';
const DEFAULT_TZ = 'UTC';

export async function getUserTimezone(): Promise<string> {
  const store = await cookies();
  const candidate = store.get(TZ_COOKIE)?.value;
  return isValidTimezone(candidate) ? candidate : DEFAULT_TZ;
}

export function zonedDayStartUTC(dateYmd: string, tz: string): string {
  return zonedWallToUTC(dateYmd, tz, { hour: 0, minute: 0, second: 0, ms: 0 });
}

export function zonedDayEndUTC(dateYmd: string, tz: string): string {
  return zonedWallToUTC(dateYmd, tz, {
    hour: 23,
    minute: 59,
    second: 59,
    ms: 999,
  });
}

interface WallClockComponents {
  hour: number;
  minute: number;
  second: number;
  ms: number;
}

function zonedWallToUTC(
  dateYmd: string,
  tz: string,
  wall: WallClockComponents,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd);
  if (!match) {
    throw new Error(`Invalid yyyy-MM-dd date: ${dateYmd}`);
  }

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const naiveUTC = Date.UTC(
    year,
    month - 1,
    day,
    wall.hour,
    wall.minute,
    wall.second,
    wall.ms,
  );

  // First pass: find the tz offset at the naive UTC instant.
  const offset1 = tzOffsetMs(tz, new Date(naiveUTC));
  const corrected = naiveUTC - offset1;
  // Second pass: re-resolve offset at the corrected instant to handle DST.
  const offset2 = tzOffsetMs(tz, new Date(corrected));
  return new Date(naiveUTC - offset2).toISOString();
}

function tzOffsetMs(tz: string, instant: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const wallAsUTC = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return wallAsUTC - instant.getTime();
}

function isValidTimezone(tz: string | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
