import { clipsRepo } from "@rotation/db";
import {
  getObjectStream,
  displayDimensions,
  needsResize,
  type ProbeJob,
} from "@rotation/shared";
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

      const { width, height, durationSeconds, rotation } = await probeFile(local);
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
      });
    });
  } catch (err) {
    await clipsRepo.setClipStatus(clip.id, "failed");
    throw err;
  }
}
