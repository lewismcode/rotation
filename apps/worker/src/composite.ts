import { unlink } from "node:fs/promises";
import { ffmpeg } from "./ffmpeg.js";
import { REELS } from "@rotation/shared";

type AudioMode = "aac" | "copy" | "none";

function errTail(stderr: string | null): string {
  return stderr ? `\n${stderr.split("\n").slice(-8).join("\n")}` : "";
}

/**
 * Two-pass composite so ffmpeg handles rotation natively (a `-vf` simple
 * filtergraph autorotates from the display matrix — no fragile manual sign
 * guessing across ffmpeg versions):
 *
 *   Pass 1 (-vf): autorotate upright, scale to cover 1080x1920, center-crop,
 *                 force 8-bit yuv420p (HDR/10-bit safe). Resilient audio:
 *                 transcode to AAC → copy source → drop (a silent reel beats a
 *                 failed render).
 *   Pass 2:       overlay the caption PNG and encode at the Reels target.
 */
export async function compositeReel(
  inputPath: string,
  overlayPath: string,
  outputPath: string
): Promise<void> {
  const basePath = `${outputPath}.base.mp4`;
  try {
    let lastErr: Error | null = null;
    let done = false;
    for (const mode of ["aac", "copy", "none"] as AudioMode[]) {
      try {
        await uprightResize(inputPath, basePath, mode);
        if (mode !== "aac") {
          console.log(`[render] audio fallback used: ${mode} (${inputPath})`);
        }
        done = true;
        break;
      } catch (err) {
        lastErr = err as Error;
      }
    }
    if (!done) throw lastErr ?? new Error("ffmpeg resize failed");

    await overlayCaption(basePath, overlayPath, outputPath);
  } finally {
    await unlink(basePath).catch(() => {});
  }
}

/** Pass 1: ffmpeg-native autorotate + cover-crop to 1080x1920 (no -map so the
 * filtered video + audio auto-map; -map would disable video mapping). */
function uprightResize(
  inputPath: string,
  basePath: string,
  audioMode: AudioMode
): Promise<void> {
  const { WIDTH, HEIGHT } = REELS;
  const audio =
    audioMode === "none"
      ? ["-an"]
      : audioMode === "copy"
        ? ["-c:a", "copy"]
        : ["-c:a", "aac", "-b:a", REELS.AUDIO_BITRATE];

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .videoFilters(
        `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,` +
          `crop=${WIDTH}:${HEIGHT},format=yuv420p,setsar=1`
      )
      .outputOptions([
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        ...audio,
        "-movflags",
        "+faststart",
      ])
      .on("end", () => resolve())
      .on("error", (err: Error, _o: string | null, stderr: string | null) =>
        reject(new Error(`${err.message}${errTail(stderr)}`))
      )
      .save(basePath);
  });
}

/** Pass 2: overlay the caption onto the already-upright base and encode. */
function overlayCaption(
  basePath: string,
  overlayPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(basePath)
      .input(overlayPath)
      .complexFilter(["[0:v][1:v]overlay=0:0[v]"])
      .outputOptions([
        "-map",
        "[v]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
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
        "-c:a",
        "copy",
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
