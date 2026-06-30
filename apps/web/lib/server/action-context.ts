import 'server-only';

import { headers } from 'next/headers';

import { getServerMonitoringService } from '@kit/monitoring/server';
import { getLogger } from '@kit/shared/logger';

/**
 * Shared error-handling primitives for server actions and route handlers.
 *
 * Goals (see the card-flow error-handling standard):
 * - never silent: every failure path logs and, if unexpected, reports to Sentry;
 * - never generic: failures carry a specific string-literal `code`, not free text;
 * - always trackable: every result carries a `reference` (the request correlation
 *   id from `proxy.ts`) that ties a user-facing failure to its server log line and
 *   Sentry event by a single id.
 */

const CORRELATION_HEADER = 'x-correlation-id';

type Logger = Awaited<ReturnType<typeof getLogger>>;

export interface ActionContext {
  /** Stable handler name — the `name` field on every log line. */
  readonly name: string;
  /** Request correlation id; surfaced to the user as a support reference. */
  readonly reference: string;
  readonly logger: Logger;
}

export interface ActionFailure<Code extends string> {
  readonly success: false;
  readonly code: Code;
  readonly reference: string;
}

/**
 * Reads the per-request correlation id set in `proxy.ts`. Falls back to a fresh
 * id when the header is absent (e.g. an execution context the proxy did not run
 * for) so a reference is *always* available — it is never empty.
 */
export async function getCorrelationId(): Promise<string> {
  try {
    const headerStore = await headers();

    return headerStore.get(CORRELATION_HEADER) ?? crypto.randomUUID();
  } catch {
    // `headers()` throws outside a request scope — still return a usable id.
    return crypto.randomUUID();
  }
}

/**
 * Next.js implements `redirect()` / `notFound()` / access fallbacks by throwing
 * a tagged error. Those are control flow, not faults — they must propagate
 * untouched and must never be logged as errors or reported to Sentry.
 */
function isFrameworkError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) {
    return false;
  }

  const digest = (error as { digest: unknown }).digest;

  if (typeof digest !== 'string') {
    return false;
  }

  return (
    digest.startsWith('NEXT_REDIRECT') ||
    digest === 'NEXT_NOT_FOUND' ||
    digest.startsWith('NEXT_HTTP_ERROR_FALLBACK')
  );
}

/**
 * Builds a typed, logged failure. Every *expected* failure path returns one of
 * these instead of throwing — a specific `code` plus the request `reference`.
 * The matching log line lets support trace the same reference end to end.
 *
 * @param level `warn` for expected/user-facing outcomes, `error` for faults that
 *   should page someone. Defaults to `warn`.
 */
export function fail<Code extends string>(
  ctx: ActionContext,
  code: Code,
  options?: {
    /** Structured detail for the log only — never returned to the client. */
    detail?: Record<string, unknown>;
    level?: 'warn' | 'error';
  },
): ActionFailure<Code> {
  const level = options?.level ?? 'warn';

  ctx.logger[level](
    { name: ctx.name, reference: ctx.reference, code, ...options?.detail },
    `${ctx.name}: ${code}`,
  );

  return { success: false, code, reference: ctx.reference };
}

/**
 * Runs an action/handler body with a ready {@link ActionContext} and a safety
 * net: any *unexpected* throw is logged and reported to the monitoring service
 * (Sentry), tagged with the reference, then rethrown. Framework control-flow
 * throws (`redirect`/`notFound`) are rethrown untouched.
 *
 * Expected failures should use {@link fail} and return normally — they are not
 * exceptions and must not reach Sentry.
 */
export async function withActionContext<T>(
  name: string,
  run: (ctx: ActionContext) => Promise<T>,
): Promise<T> {
  const [reference, logger] = await Promise.all([
    getCorrelationId(),
    getLogger(),
  ]);

  const ctx: ActionContext = { name, reference, logger };

  try {
    return await run(ctx);
  } catch (error) {
    if (isFrameworkError(error)) {
      throw error;
    }

    logger.error({ name, reference, error }, `${name}: unhandled exception`);

    const monitoring = await getServerMonitoringService();
    monitoring.captureException(error as Error, { action: name, reference });

    throw error;
  }
}
