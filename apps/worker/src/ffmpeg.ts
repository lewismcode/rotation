import ffmpeg from "fluent-ffmpeg";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Resolve the ffmpeg/ffprobe binaries in priority order:
 *   1. explicit env override (FFMPEG_PATH / FFPROBE_PATH)
 *   2. the npm-bundled static binaries (ffmpeg-static / ffprobe-static) — these
 *      install regardless of the host builder (Railway Nixpacks OR Railpack),
 *      which is why they're the primary path in production
 *   3. fall back to whatever is on PATH (e.g. a system/Nix ffmpeg)
 *
 * They're optionalDependencies: if their binary download is unavailable (e.g. a
 * locked-down CI network), install still succeeds and we fall back to PATH.
 */
function fromEnv(value: string | undefined): string | null {
  return value && existsSync(value) ? value : null;
}

function fromPackage<T>(pkg: string, pick: (mod: T) => string | undefined): string | null {
  try {
    const mod = require(pkg) as T;
    const p = pick(mod);
    return p && existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

// ffmpeg-static exports the path string directly; ffprobe-static exports { path }.
const ffmpegPath =
  fromEnv(process.env.FFMPEG_PATH) ??
  fromPackage<string>("ffmpeg-static", (m) => m);
const ffprobePath =
  fromEnv(process.env.FFPROBE_PATH) ??
  fromPackage<{ path: string }>("ffprobe-static", (m) => m?.path);

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);

console.log(
  `[ffmpeg] ffmpeg=${ffmpegPath ?? "(PATH)"} ffprobe=${ffprobePath ?? "(PATH)"}`
);

export { ffmpeg };

export interface ProbeResult {
  width: number;
  height: number;
  durationSeconds: number;
}

export function probeFile(path: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, data) => {
      if (err) return reject(err);
      const stream = data.streams.find((s) => s.codec_type === "video");
      if (!stream || !stream.width || !stream.height) {
        return reject(new Error("No video stream found in file"));
      }
      const duration =
        Number(data.format?.duration) || Number(stream.duration) || 0;
      resolve({
        width: stream.width,
        height: stream.height,
        durationSeconds: Number.isFinite(duration) ? duration : 0,
      });
    });
  });
}
