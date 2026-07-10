import ffmpeg from "fluent-ffmpeg";

/**
 * fluent-ffmpeg resolves `ffmpeg`/`ffprobe` from PATH by default. On Railway the
 * worker image installs ffmpeg via nixpacks (see apps/worker/nixpacks.toml); for
 * local dev install ffmpeg with your package manager. Set FFMPEG_PATH /
 * FFPROBE_PATH to point at a specific build (e.g. a hardware-accelerated one).
 */
if (process.env.FFMPEG_PATH) ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
if (process.env.FFPROBE_PATH) ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

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
