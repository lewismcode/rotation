# Deploying Rotation on Railway

This is a monorepo with **two long-running services** (web + worker) plus
**Postgres** and **Redis**. Both services deploy from the **repo root** (so npm
workspaces resolve) and are differentiated by their build/start commands.

Once Clerk and R2 are set up, this is deploy-and-test — no code changes needed.

## 0. Prerequisites (external services)

- **Clerk** — an application with **Organizations enabled**, one org created (your
  label), and at least one member. Org members with the `org:admin` role become
  `admin` (can manage hooks); everyone else is an `artist`. Grab the publishable
  and secret keys. MVP is invite-only — no public sign-up is built.
- **Cloudflare R2** — a bucket + an API token (access key + secret). Add CORS so
  the browser can upload/download directly:
  ```json
  [{ "AllowedOrigins": ["https://YOUR-WEB-DOMAIN"],
     "AllowedMethods": ["PUT", "GET"],
     "AllowedHeaders": ["*"],
     "ExposeHeaders": ["ETag"] }]
  ```
  (Add `http://localhost:3000` too for local dev.)

## 1. Create the Railway project

1. New Project → Deploy from this GitHub repo.
2. Add the **PostgreSQL** and **Redis** plugins to the project. They expose
   `DATABASE_URL` and `REDIS_URL` as reference variables.

## 2. Service: `web`

- **Root directory:** repo root (default).
- **Build command:** `npm run build:web`
- **Pre-Deploy command:** `npm run db:migrate` (creates/updates the schema once
  per deploy, before the new version goes live).
- **Start command:** `npm run start:web`
- **Networking:** generate a public domain. Set it as the Clerk allowed origin
  and the R2 CORS origin.

## 3. Service: `worker`

- Add a **second service** from the **same repo** (New Service → GitHub → same
  repo). Root directory: repo root.
- **Build command:** *(leave default — the root `build` script is a no-op, so
  the worker never rebuilds the web app; it just runs TypeScript via `tsx`)*.
- **Start command:** `npm run start:worker`
- ffmpeg is provided by the root `nixpacks.toml`.

> The root `npm run build` is intentionally a no-op. Only the web service builds,
> via `npm run build:web`. This keeps the worker's build fast and prevents a web
> build issue from ever failing the worker.

## 4. Environment variables

**Infra vars — on BOTH services** (`DATABASE_URL`/`REDIS_URL` reference the
plugins). The worker needs these to reach R2/DB/Redis:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=rotation
```

**Clerk vars — on the `web` service only** (the worker never touches Clerk).
Both keys come from the Clerk dashboard → your app → **API keys**:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...   # the "Public key" (client, build-time)
CLERK_SECRET_KEY=sk_...                     # the "default" secret key (server-only)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/batches
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/batches
```

> Enable **Organizations** in Clerk (Organizations tab). On first login the app
> shows a "choose/create your label" screen — that creates the org (= label) and
> unblocks the app. `pk_test_`/`sk_test_` (Development instance) keys are fine for
> testing.

Worker-only optional tuning: `RENDER_CONCURRENCY`, `PROBE_CONCURRENCY`,
`FONT_PATH` (see below).

> **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is baked in at *build* time.** It's a
> client-side variable inlined into the browser bundle when `next build` runs.
> The build itself now succeeds without it (all routes are dynamic), but the web
> app can't authenticate until it's rebuilt with the key present. Railway exposes
> service variables to the build, so: set the Clerk keys on the `web` service,
> then redeploy. The R2 and Postgres/Redis vars are only read at request time, so
> they don't need to be present for the build.

## 5. Seed starter hooks (once)

From a Railway one-off shell on the `web` service (it has `DATABASE_URL`):

```
SEED_CLERK_ORG_ID=org_your_real_org_id npm run db:seed
```

This attaches ~15 clearly-labeled placeholder hooks to your label. (You can also
just add hooks in the in-app Hooks admin.)

## 6. Fonts for captions (recommended)

Caption fidelity depends on a **bold** font being available to the worker. The
renderer falls back to a system font, then generic sans-serif. For IG-accurate
captions, commit a bold TTF to `apps/worker/assets/fonts/` (e.g. `Inter-Bold.ttf`)
or set `FONT_PATH`.

> **Emoji hooks:** to render emoji (e.g. 🔊) instead of a "tofu" box, the worker
> also needs a color-emoji font (e.g. **Noto Color Emoji**) available to
> fontconfig, or an emoji-font fallback added to the overlay module. Plain-text
> hooks render fine without it.

## Notes / caveats

- Both services install the full workspace at build (`npm install` in the root
  `nixpacks.toml`), so devDependencies (Next build tools) are present at build
  time. `tsx` is a **runtime** dependency of the worker and db packages, so the
  worker and migrations run even if the runtime image prunes devDependencies.
- The worker is a background process; it doesn't need a public domain (it exposes
  a `/health` endpoint on `$PORT` for Railway health checks).
- Scale render throughput by raising `RENDER_CONCURRENCY` or running multiple
  worker replicas — jobs are pulled from the shared Redis queue.
