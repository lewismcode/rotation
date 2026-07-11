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
export async function compositeReel(
  inputPath: string,
  overlayPath: string,
  outputPath: string
): Promise<void> {
  let lastErr: Error | null = null;
  for (const mode of ["aac", "copy", "none"] as AudioMode[]) {
    try {
      await run(inputPath, overlayPath, outputPath, mode);
      if (mode !== "aac") {
        console.log(`[render] audio fallback used: ${mode} (${inputPath})`);
      }
      return;
    } catch (err) {
      lastErr = err as Error;
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

function run(
  inputPath: string,
  overlayPath: string,
  outputPath: string,
  audioMode: AudioMode
): Promise<void> {
  const { WIDTH, HEIGHT } = REELS;
  const graph =
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${WIDTH}:${HEIGHT},format=yuv420p,setsar=1[b];` +
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
