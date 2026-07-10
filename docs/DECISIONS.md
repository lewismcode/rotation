# Decisions & open questions

This file captures the choices made during the MVP build and the questions the
spec asked to **flag back, not guess silently**. Defaults are in place so the
app works end to end; please confirm the flagged items.

## Defaults chosen (change if needed)

| Area | Default | Where |
| --- | --- | --- |
| Export resolution | 1080×1920 (9:16) | `packages/shared/src/constants.ts` → `REELS` |
| Video codec | H.264 (`libx264`), `high` profile, `yuv420p`, `+faststart` | `apps/worker/src/processors/render.ts` |
| Bitrate | ~9 Mbps target, 12 Mbps max, 18 Mbps bufsize | `REELS.VIDEO_BITRATE` |
| Audio | AAC 128 kbps | `REELS` |
| Resize strategy | cover + **center-crop** (never stretch) | `runFfmpeg` in `render.ts` |
| Caption style | white bold sans on semi-transparent dark pills, upper third | `apps/worker/src/overlay/renderHookPng.ts` |
| Queue | BullMQ + Redis | `packages/queue` |

## ❓ Open questions flagged from the spec

1. **Exact export spec (resolution / bitrate / codec).**
   Current defaults are a sane IG target but were **not** validated against a
   real current IG Reels upload. Please confirm quality vs. file size against an
   actual export from the IG app so we can lock `REELS.*`.

2. **Max clip length / max batch size.**
   Provisional guardrails are set in `LIMITS` (`constants.ts`):
   - max clip duration: **120s**
   - max clips per batch: **50**
   - max hooks per batch: **20**
   - max renders per batch: **300**
   - max upload size: **500 MB / clip**
   Confirm these match how the label actually works, or adjust.

   > Note: duration is probed and stored, but the confirm step does not yet
   > hard-reject over-length clips — it only bounds the render fan-out. Say the
   > word and I'll enforce `MAX_CLIP_DURATION_SECONDS` at confirm time.

3. **Is center-crop always acceptable?**
   We center-crop non-9:16 footage. Some source footage (e.g. a subject framed
   off-center) may need manual crop-position control. The renderer is isolated
   (`overlay/` + `runFfmpeg`) so adding a per-clip crop offset later is a
   contained change — but for MVP everything is center-cropped. Confirm that's
   fine to ship.

## Notes for later phases (architected for, not built)

- `hooks.source` column already exists (`manual | ai`) for future AI hook
  suggestions — no migration needed to add them.
- Caption rendering is a single pure module (`renderHookPng`) so a fully
  customizable font/position/animation editor can swap it without touching the
  ffmpeg pipeline.
- Everything is `label_id`-scoped already, so a second label signing up needs no
  data-model change — just a second Clerk org.
- No logo/watermark step is built, but nothing hardcodes its absence; it would
  be another overlay layer in `renderHookPng` / the composite filter.
