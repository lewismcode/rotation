import * as Sentry from "@sentry/node";

/**
 * Worker error reporting. Initializes Sentry at import time when SENTRY_DSN is
 * set (a no-op otherwise), and exposes a guarded capture helper. Import this
 * module first in the entrypoint so init runs before any job is processed.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
  console.log("[sentry] initialized (worker)");
}

export function captureError(
  err: unknown,
  context?: Record<string, unknown>
): void {
  if (!dsn) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
