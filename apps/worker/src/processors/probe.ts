import { clipsRepo } from "@rotation/db";
import { getObjectStream, ASPECT_TOLERANCE, REELS, type ProbeJob } from "@rotation/shared";
import { probeFile } from "../ffmpeg.js";
import { withTmpDir, streamToFile, joinPath } from "../util/tmp.js";

/**
 * After a client uploads a clip to R2, we probe its real dimensions/duration
 * and decide whether it needs resize/crop to 9:16. We stream only enough to let
 * ffprobe read the header, but for simplicity (and because clips are bounded in
 * size) we pull the whole object to a temp file.
 */
export async function processProbe(job: ProbeJob): Promise<void> {
  const clip = await clipsRepo.getClipScoped(job.labelId, job.clipId);
  if (!clip) {
    // Clip vanished (batch deleted) — nothing to do.
    return;
  }
  await clipsRepo.setClipStatus(clip.id, "probing");

  try {
    await withTmpDir(async (dir) => {
      const local = joinPath(dir, "input");
      const stream = await getObjectStream(clip.r2_key_original);
      await streamToFile(stream, local);

      const { width, height, durationSeconds } = await probeFile(local);
      const aspect = width / height;
      // needs_resize drives the "will be cropped/reframed" warning, so it keys
      // off aspect mismatch only. A same-aspect clip at a different resolution
      // (e.g. 720x1280) is upscaled by the render step without reframing, so it
      // doesn't warrant the crop warning.
      const needsResize = Math.abs(aspect - REELS.ASPECT) > ASPECT_TOLERANCE;

      await clipsRepo.setClipProbe(clip.id, {
        width,
        height,
        durationSeconds,
        needsResize,
      });
    });
  } catch (err) {
    await clipsRepo.setClipStatus(clip.id, "failed");
    throw err;
  }
}
