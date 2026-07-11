import ffmpeg from "fluent-ffmpeg";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const pexec = promisify(execFile);

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

/** Resolved ffprobe binary (path or PATH lookup) for direct JSON queries. */
const ffprobeBin = ffprobePath ?? "ffprobe";

console.log(
  `[ffmpeg] ffmpeg=${ffmpegPath ?? "(PATH)"} ffprobe=${ffprobePath ?? "(PATH)"}`
);

export { ffmpeg };

export interface ProbeResult {
  /** Coded frame dimensions (before display rotation). */
  width: number;
  height: number;
  durationSeconds: number;
  /** Clockwise rotation to apply for correct display: 0 | 90 | 180 | 270. */
  rotation: number;
  /** color_transfer (e.g. smpte2084, arib-std-b67) — used for HDR detection. */
  colorTransfer: string | null;
  /** color_primaries (e.g. bt2020) — used for HDR detection. */
  colorPrimaries: string | null;
}

/**
 * HDR footage (iPhone Dolby Vision / HDR10, HLG) uses a PQ or HLG transfer
 * curve and/or BT.2020 primaries. Encoded to SDR H.264 without tone-mapping it
 * comes out washed-out and grey, so this flags clips that need the tonemap path.
 */
export function isHdr(res: {
  colorTransfer: string | null;
  colorPrimaries: string | null;
}): boolean {
  const t = res.colorTransfer?.toLowerCase();
  const p = res.colorPrimaries?.toLowerCase();
  return (
    t === "smpte2084" || // PQ / HDR10 / Dolby Vision
    t === "arib-std-b67" || // HLG
    p === "bt2020"
  );
}

/**
 * Normalize rotation to the clockwise angle needed to display the frame
 * upright. iPhone vertical clips store a landscape frame + a rotation flag, via
 * either a Display Matrix side-data entry (counter-clockwise convention) or a
 * legacy `rotate` tag (clockwise).
 */
interface FfprobeStreamJson {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
  color_transfer?: string;
  color_primaries?: string;
  tags?: { rotate?: string | number };
  side_data_list?: Array<{ rotation?: number }>;
}

/** Snap an arbitrary rotation to the clockwise 0/90/180/270 display angle. */
export function normalizeRotation(raw: number | undefined | null): number {
  if (raw == null || Number.isNaN(raw)) return 0;
  return (((Math.round(raw / 90) * 90) % 360) + 360) % 360;
}

function readRotation(stream: FfprobeStreamJson): number {
  let raw: number | undefined;
  const sd = stream.side_data_list?.find((d) => typeof d.rotation === "number");
  if (sd && typeof sd.rotation === "number") raw = -sd.rotation;
  else if (stream.tags?.rotate != null) raw = Number(stream.tags.rotate);
  return normalizeRotation(raw);
}

/**
 * Probe via a direct `ffprobe -show_streams -of json` call so the Display
 * Matrix side-data (iPhone rotation) is always present — fluent-ffmpeg's parser
 * can drop nested arrays depending on version.
 */
export async function probeFile(path: string): Promise<ProbeResult> {
  const { stdout } = await pexec(ffprobeBin, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    path,
  ]);
  const data = JSON.parse(stdout) as {
    streams?: FfprobeStreamJson[];
    format?: { duration?: string };
  };
  const stream = (data.streams ?? []).find((s) => s.codec_type === "video");
  if (!stream?.width || !stream?.height) {
    throw new Error("No video stream found in file");
  }
  const duration =
    Number(data.format?.duration) || Number(stream.duration) || 0;
  return {
    width: stream.width,
    height: stream.height,
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    rotation: readRotation(stream),
    colorTransfer: stream.color_transfer ?? null,
    colorPrimaries: stream.color_primaries ?? null,
  };
}
