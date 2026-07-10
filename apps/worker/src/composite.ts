import { ffmpeg } from "./ffmpeg.js";
import { REELS } from "@rotation/shared";

/**
 * The single ffmpeg composite step, extracted so both the render processor and
 * tooling/demos exercise the exact same pixels. cover-crop then overlay:
 *   [0:v] scale to cover 1080x1920, center-crop, reset SAR  -> [base]
 *   [base][1:v] overlay caption png at 0,0                  -> [v]
 * Audio is passed through/re-encoded if present (0:a?).
 */
export function compositeReel(
  inputPath: string,
  overlayPath: string,
  outputPath: string
): Promise<void> {
  const { WIDTH, HEIGHT } = REELS;
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .input(overlayPath)
      .complexFilter([
        `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,` +
          `crop=${WIDTH}:${HEIGHT},setsar=1[base]`,
        `[base][1:v]overlay=0:0:format=auto[v]`,
      ])
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
        "aac",
        "-b:a",
        REELS.AUDIO_BITRATE,
        "-movflags",
        "+faststart",
        "-shortest",
      ])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}
