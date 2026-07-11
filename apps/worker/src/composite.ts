import { ffmpeg, probeFile } from "./ffmpeg.js";
import { REELS } from "@rotation/shared";

/** Bake the display rotation into pixels (filter_complex disables autorotate). */
function transposePrefix(rotation: number): string {
  if (rotation === 90) return "transpose=1,";
  if (rotation === 270) return "transpose=2,";
  if (rotation === 180) return "transpose=1,transpose=1,";
  return "";
}

type AudioMode = "aac" | "copy" | "none";

function audioOptions(mode: AudioMode): string[] {
  if (mode === "none") return ["-an"];
  if (mode === "copy") return ["-map", "0:a:0?", "-c:a", "copy"];
  return ["-map", "0:a:0?", "-c:a", "aac", "-b:a", REELS.AUDIO_BITRATE];
}

/**
 * The single ffmpeg composite step, extracted so both the render processor and
 * tooling/demos exercise the exact same pixels.
 *
 *   [0:v] rotate upright, scale to cover 1080x1920, center-crop, force 8-bit
 *         yuv420p (so HDR/10-bit iPhone footage doesn't break the overlay), reset
 *         SAR                                                          -> [base]
 *   [base][1:v] overlay caption png                                    -> [v]
 *
 * Audio is resilient: transcode to AAC when possible, else copy the source
 * stream untouched (some phone clips carry audio ffmpeg can't re-encode), else
 * drop it — a silent reel beats a failed render.
 */
export async function compositeReel(
  inputPath: string,
  overlayPath: string,
  outputPath: string
): Promise<void> {
  let rotation = 0;
  try {
    rotation = (await probeFile(inputPath)).rotation;
  } catch {
    /* fall back to no rotation */
  }

  const modes: AudioMode[] = ["aac", "copy", "none"];
  let lastErr: Error | null = null;
  for (const mode of modes) {
    try {
      await runComposite(inputPath, overlayPath, outputPath, rotation, mode);
      if (mode !== "aac") {
        console.log(`[render] audio fallback used: ${mode} (${inputPath})`);
      }
      return;
    } catch (err) {
      lastErr = err as Error;
      // ffmpeg fails fast at init on audio problems, so retrying is cheap.
    }
  }
  throw lastErr ?? new Error("ffmpeg composite failed");
}

function runComposite(
  inputPath: string,
  overlayPath: string,
  outputPath: string,
  rotation: number,
  audioMode: AudioMode
): Promise<void> {
  const { WIDTH, HEIGHT } = REELS;
  const pre = transposePrefix(rotation);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .input(overlayPath)
      .complexFilter([
        `[0:v]${pre}scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,` +
          `crop=${WIDTH}:${HEIGHT},format=yuv420p,setsar=1[base]`,
        `[base][1:v]overlay=0:0[v]`,
      ])
      .outputOptions([
        "-map",
        "[v]",
        ...audioOptions(audioMode),
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
        "-movflags",
        "+faststart",
        // pixels are already upright; clear any rotation metadata.
        "-metadata:s:v:0",
        "rotate=0",
        "-shortest",
      ])
      .on("end", () => resolve())
      .on("error", (err: Error, _stdout: string | null, stderr: string | null) => {
        const tail = stderr ? `\n${stderr.split("\n").slice(-8).join("\n")}` : "";
        reject(new Error(`${err.message}${tail}`));
      })
      .save(outputPath);
  });
}
