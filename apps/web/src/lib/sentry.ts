/**
 * Minimal Sentry reporting for the web app. Sentry is initialized lazily on the
 * first captured error (kept entirely inside the Node runtime route-handler
 * path, so it never gets pulled into the edge/instrumentation bundle). A no-op
 * unless SENTRY_DSN is set, and never throws — reporting must not mask the
 * original failure.
 */
let inited = false;

export async function captureError(err: unknown): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/node");
    if (!inited) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 0,
      });
      inited = true;
    }
    Sentry.captureException(err);
  } catch {
    // swallow — reporting failure shouldn't affect the response
  }
}
