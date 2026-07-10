import { z } from "zod";

/**
 * Server-side environment. Validated lazily so importing this package in the
 * browser bundle (types only) doesn't blow up. Call `serverEnv()` from Node
 * contexts (API routes, worker) only.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),

  // Cloudflare R2 (S3-compatible)
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  /** Optional public/base endpoint override; derived from account id if unset. */
  R2_ENDPOINT: z.string().url().optional(),

  // Queue (BullMQ / Redis)
  REDIS_URL: z.string().min(1),

  // Clerk
  CLERK_SECRET_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    throw new Error(
      `Invalid/missing server environment variables:\n  ${missing}\n` +
        `See .env.example for the full list.`
    );
  }
  cached = parsed.data;
  return cached;
}
