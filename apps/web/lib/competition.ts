/**
 * M2.5 #14 — competition window helpers. The window is stored on
 * districts.config jsonb as { competition_start (ISO date), competition_days }.
 * The derived end date is the finish line for goal bars + prize tiers; the home
 * screen shows a live countdown, and prizes resolve at close.
 *
 * Pure + client-safe (no server imports).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CompetitionWindow {
  /** ISO date (YYYY-MM-DD) the window opens. */
  startDate: string;
  /** Window length in days (30 / 40 / 60). */
  days: number;
  /** Derived ISO date (YYYY-MM-DD) the window closes. */
  endDate: string;
  /** Whole days remaining until close (0 once closed). */
  daysLeft: number;
  isOpen: boolean;
  isClosed: boolean;
}

/**
 * Parse a district's competition window from its `config` jsonb, or null if it
 * isn't configured / is malformed.
 */
export function parseCompetitionWindow(config: unknown): CompetitionWindow | null {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return null;
  }

  const c = config as Record<string, unknown>;
  const start =
    typeof c.competition_start === 'string' ? c.competition_start : null;
  const days =
    typeof c.competition_days === 'number' ? c.competition_days : null;

  if (!start || !days || days <= 0) {
    return null;
  }

  const startMs = Date.parse(start);
  if (Number.isNaN(startMs)) {
    return null;
  }

  const endMs = startMs + days * DAY_MS;
  const now = Date.now();

  return {
    startDate: start,
    days,
    endDate: new Date(endMs).toISOString().slice(0, 10),
    daysLeft: Math.max(0, Math.ceil((endMs - now) / DAY_MS)),
    isOpen: now >= startMs && now < endMs,
    isClosed: now >= endMs,
  };
}
