import { ffmpeg } from "./ffmpeg.js";
import { REELS } from "@rotation/shared";

type AudioMode = "aac" | "copy" | "none";

// x264 speed/quality preset. veryfast is a big speed win over medium at this
// bitrate with negligible quality loss for social video (IG re-encodes anyway).
const PRESET = process.env.X264_PRESET || "veryfast";

function audioOptions(mode: AudioMode): string[] {
  if (mode === "none") return ["-an"];
  if (mode === "copy") return ["-c:a", "copy"];
  return ["-c:a", "aac", "-b:a", REELS.AUDIO_BITRATE];
}

function errTail(stderr: string | null): string {
  return stderr ? `\n${stderr.split("\n").slice(-8).join("\n")}` : "";
}

// Escape a path for use inside ffmpeg's movie= filter argument.
function escFilterPath(p: string): string {
  return p.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
}

/**
 * Single-pass composite. A `-vf` simple filtergraph is used (not
 * -filter_complex) so ffmpeg autorotates the input from its display matrix —
 * correct across ffmpeg versions, no manual sign guessing — while the caption
 * PNG is pulled in via the `movie` source filter so it all happens in one
 * encode:
 *
 *   autorotate -> scale to cover 1080x1920 -> center-crop -> force 8-bit
 *   (HDR/10-bit safe) -> overlay caption
 *
 * Audio is resilient: transcode to AAC -> copy the source stream -> drop it
 * (a silent reel beats a failed render). No explicit -map, so the filtered
 * video + audio auto-map (a -map would disable video mapping with -vf).
 */
export interface CropAnchor {
  /** Normalized 0..1 horizontal anchor (0 = left, 1 = right, 0.5 = center). */
  x: number;
  /** Normalized 0..1 vertical anchor (0 = top, 1 = bottom, 0.5 = center). */
  y: number;
}

export interface CompositeOptions {
  anchor?: CropAnchor;
  /** Source is HDR (PQ/HLG/BT.2020) — tone-map to SDR before encoding. */
  hdr?: boolean;
}

export async function compositeReel(
  inputPath: string,
  overlayPath: string,
  outputPath: string,
  options: CompositeOptions = {}
): Promise<void> {
  const anchor = options.anchor ?? { x: 0.5, y: 0.5 };
  // Try the tonemap path first for HDR sources; if the build lacks zscale/zimg
  // (or the chain otherwise errors) fall back to a plain encode so the render
  // still succeeds — a slightly-washed SDR reel beats no reel.
  const tonemapModes = options.hdr ? [true, false] : [false];
  let lastErr: Error | null = null;
  for (const tonemap of tonemapModes) {
    for (const mode of ["aac", "copy", "none"] as AudioMode[]) {
      try {
        await run(inputPath, overlayPath, outputPath, mode, anchor, tonemap);
        if (mode !== "aac") {
          console.log(`[render] audio fallback used: ${mode} (${inputPath})`);
        }
        if (options.hdr && !tonemap) {
          console.warn(`[render] HDR tonemap unavailable, plain encode (${inputPath})`);
        }
        return;
      } catch (err) {
        lastErr = err as Error;
      }
    }
  }
  throw lastErr ?? new Error("ffmpeg composite failed");
}

/**
 * Extract a ~320px-wide JPEG thumbnail from a finished render. Seeks to ~1s to
 * skip black/fade-in frames; if the clip is shorter than that (seek yields
 * nothing), falls back to the first frame.
 */
export async function extractThumbnail(
  videoPath: string,
  thumbPath: string
): Promise<void> {
  const attempt = (seek: number): Promise<void> =>
    new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .inputOptions(["-ss", String(seek)])
        .outputOptions(["-frames:v", "1", "-vf", "scale=320:-2", "-q:v", "3"])
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .save(thumbPath);
    });
  try {
    await attempt(1);
  } catch {
    await attempt(0);
  }
}

// Clamp + format a normalized anchor for an ffmpeg expression. toFixed avoids
// locale/scientific-notation surprises in the filter string.
function anchorExpr(v: number): string {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5)).toFixed(4);
}

// HDR (PQ/HLG, BT.2020) -> SDR (BT.709). Linearize, tone-map highlights with
// Hable, then convert back to bt709 tv-range before the normal scale/crop.
const TONEMAP =
  "zscale=t=linear:npl=100,tonemap=tonemap=hable:desat=0," +
  "zscale=t=bt709:m=bt709:p=bt709:r=tv,";

function run(
  inputPath: string,
  overlayPath: string,
  outputPath: string,
  audioMode: AudioMode,
  anchor: CropAnchor,
  tonemap: boolean
): Promise<void> {
  const { WIDTH, HEIGHT } = REELS;
  // After scaling to cover 1080x1920, exactly one axis overflows; the crop x/y
  // pan along it. (iw-WIDTH) or (ih-HEIGHT) is 0 on the non-overflowing axis, so
  // the corresponding anchor has no effect — center stays center there.
  const ax = anchorExpr(anchor.x);
  const ay = anchorExpr(anchor.y);
  const graph =
    `${tonemap ? TONEMAP : ""}` +
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${WIDTH}:${HEIGHT}:(iw-${WIDTH})*${ax}:(ih-${HEIGHT})*${ay},` +
    `format=yuv420p,setsar=1[b];` +
    `movie='${escFilterPath(overlayPath)}'[h];[b][h]overlay=0:0`;

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .outputOptions([
        "-vf",
        graph,
        "-c:v",
        "libx264",
        "-preset",
        PRESET,
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        "-b:v",
        REELS.VIDEO_BITRATE,
        "-maxrate",
        REELS.VIDEO_MAXRATE,
        "-bufsize",
        REELS.VIDEO_BUFSIZE,
        ...audioOptions(audioMode),
        "-movflags",
        "+faststart",
        "-shortest",
      ])
      .on("end", () => resolve())
      .on("error", (err: Error, _o: string | null, stderr: string | null) =>
        reject(new Error(`${err.message}${errTail(stderr)}`))
      )
      .save(outputPath);
  });
}
