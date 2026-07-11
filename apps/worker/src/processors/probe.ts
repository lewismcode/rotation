import { clipsRepo } from "@rotation/db";
import {
  getObjectStream,
  displayDimensions,
  needsResize,
  type ProbeJob,
} from "@rotation/shared";
import { probeFile, isHdr } from "../ffmpeg.js";
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

      const probe = await probeFile(local);
      const { width, height, durationSeconds, rotation } = probe;
      // Use DISPLAY dimensions: a rotated (portrait iPhone) clip is coded
      // landscape, so swap w/h when rotated 90/270 before judging the aspect.
      const disp = displayDimensions(width, height, rotation);

      await clipsRepo.setClipProbe(clip.id, {
        width: disp.width,
        height: disp.height,
        durationSeconds,
        // Same-aspect clips at a lower resolution are upscaled without a crop,
        // so this keys off aspect mismatch only (drives the reframe warning).
        needsResize: needsResize(disp.width, disp.height),
        // Detect HDR once here so the render step doesn't have to re-probe.
        isHdr: isHdr(probe),
      });
    });
  } catch (err) {
    // Leave the status alone (still 'probing') and rethrow so BullMQ retries.
    // The 'failed' handler flips it to 'failed' only once attempts are spent,
    // so a transient probe error doesn't blink the clip to failed mid-retry.
    throw err;
  }
}

/**
 * Mark a clip failed after its probe job has exhausted all attempts. Called
 * from the queue 'failed' handler only. No-op if the clip vanished or a retry
 * already succeeded (status 'ready').
 */
export async function markClipFailedFinal(job: ProbeJob): Promise<void> {
  const clip = await clipsRepo.getClipScoped(job.labelId, job.clipId);
  if (!clip || clip.status === "ready") return;
  await clipsRepo.setClipStatus(clip.id, "failed");
}
