# Rotation

Drop a folder of raw clips, pick proven **hooks**, and get back ready-to-post
Instagram Reels with the hook overlaid in native IG caption style. Built for a
record label to remove all friction from getting artists to post — artists never
edit anything.

Single-label MVP, architected as multi-tenant SaaS from day one (every row is
`label_id`-scoped; a label is a Clerk Organization).

## Architecture

```
apps/
  web/       Next.js (App Router) — UI + presign/queue API routes
  worker/    Long-running Node service — ffprobe + ffmpeg render pipeline
packages/
  shared/    Types, constants (export spec/limits), R2 client, slug helpers, env
  db/        Postgres schema, migrations, seed, label-scoped repositories
  queue/     BullMQ producers (Redis) shared by web + worker
```

- **Upload** goes **direct browser → R2** via presigned PUT (video bytes never
  touch Node).
- After upload, a **probe** job (ffprobe) records each clip's dimensions and
  flags non-9:16 clips for a resize/crop warning — shown before any processing.
- Confirming a batch fans out **one render per clip × hook**, all queued.
- The **worker** renders each: cover-crop to 1080×1920, composite the hook
  caption (rendered as a transparent PNG in `overlay/renderHookPng.ts`, then
  overlaid with ffmpeg), encode H.264, upload to R2.
- Delivery offers per-render downloads and a server-built **Download All (.zip)**.

The render/overlay code is isolated so styling can become customizable later
without touching the pipeline. See `docs/DECISIONS.md` for export-spec/limit
choices and the open questions flagged from the spec.

## Tech

Next.js · TypeScript · Tailwind · Clerk (Orgs = labels, Users = artists/staff) ·
PostgreSQL · Cloudflare R2 · BullMQ + Redis · fluent-ffmpeg (system `ffmpeg`) ·
`@napi-rs/canvas` for caption rendering · `archiver` for zips.

## Local development

Prereqs: Node 20+, Docker (for Postgres + Redis), and `ffmpeg` on your PATH
(`brew install ffmpeg` / `apt install ffmpeg`). The worker calls it directly.

```bash
# 1. Dependencies
npm install

# 2. Config
cp .env.example .env      # fill in Clerk + R2 keys (Postgres/Redis defaults work)

# 3. Infra
docker compose up -d      # postgres + redis

# 4. Database
npm run db:migrate
npm run db:seed           # ~15 starter hook examples (clearly placeholder)

# 5. Run (two terminals)
npm run dev:web           # http://localhost:3000
npm run dev:worker        # drains probe/render/zip queues
```

### Clerk setup (MVP)

1. Create a Clerk application; enable **Organizations**.
2. Create one Organization (the label). Invite users — MVP is **invite-only**
   (no public sign-up is built).
3. Org members with the `org:admin` role map to `admin` (can manage hooks);
   everyone else is an `artist`. Labels and users auto-provision into Postgres on
   first authenticated request.
4. To attach the seeded hooks to your real org, set `SEED_CLERK_ORG_ID=org_...`
   before `npm run db:seed`.

### R2 setup

Create an R2 bucket and an API token (Access Key + Secret). CORS on the bucket
must allow `PUT`/`GET` from your web origin so browser uploads/downloads work,
e.g.:

```json
[{ "AllowedOrigins": ["http://localhost:3000"],
   "AllowedMethods": ["PUT", "GET"],
   "AllowedHeaders": ["*"] }]
```

## Deploying on Railway

Two services from this one repo (web + worker), sharing env vars, plus the
Postgres and Redis plugins. `ffmpeg` is installed via the root `nixpacks.toml`;
`tsx` is a runtime dependency so the worker and migrations run in production.

See **[`DEPLOY.md`](./DEPLOY.md)** for exact per-service build/start commands,
env vars, seeding, and R2/Clerk setup. Once Clerk + R2 are configured it's
deploy-and-test with no code changes.

## Notes / limits

Export target, bitrate, and batch/clip limits live in
`packages/shared/src/constants.ts`. A few of these are provisional and flagged
for confirmation in `docs/DECISIONS.md`.
