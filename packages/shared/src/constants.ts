/**
 * Reels export target. These are the single source of truth for the render
 * pipeline. See `docs/DECISIONS.md` for the open question flagged to the label
 * owner about confirming this against a real IG upload.
 */
export const REELS = {
  WIDTH: 1080,
  HEIGHT: 1920,
  /** 9:16 as a float for aspect comparisons. */
  ASPECT: 1080 / 1920,
  /** ~9 Mbps sits in IG's sweet spot for 1080x1920 without bloating files. */
  VIDEO_BITRATE: "9M",
  VIDEO_MAXRATE: "12M",
  VIDEO_BUFSIZE: "18M",
  AUDIO_BITRATE: "128k",
  FPS_CAP: 60,
} as const;

/**
 * Guardrails against runaway ffmpeg jobs. Flagged as an open question — tune
 * with the label once real footage volume is known.
 */
export const LIMITS = {
  MAX_CLIP_DURATION_SECONDS: 120,
  MAX_CLIPS_PER_BATCH: 50,
  MAX_HOOKS_PER_BATCH: 20,
  /** clips * hooks ceiling to keep a single batch bounded. */
  MAX_RENDERS_PER_BATCH: 300,
  MAX_UPLOAD_BYTES: 500 * 1024 * 1024, // 500 MB per clip
} as const;

/**
 * Tolerance when deciding whether a clip is "already 9:16" and can skip the
 * resize/crop path. Anything outside this needs a resize warning.
 */
export const ASPECT_TOLERANCE = 0.01;

export const ALLOWED_VIDEO_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
] as const;

/** R2 key prefixes — kept centralized so the layout stays consistent. */
export const R2_PREFIX = {
  original: (labelId: string, batchId: string, clipId: string, filename: string) =>
    `labels/${labelId}/batches/${batchId}/originals/${clipId}/${filename}`,
  output: (labelId: string, batchId: string, renderId: string, filename: string) =>
    `labels/${labelId}/batches/${batchId}/outputs/${renderId}/${filename}`,
  zip: (labelId: string, batchId: string) =>
    `labels/${labelId}/batches/${batchId}/rotation-batch-${batchId}.zip`,
} as const;

export const QUEUE = {
  PROBE: "rotation-probe",
  RENDER: "rotation-render",
  ZIP: "rotation-zip",
} as const;
