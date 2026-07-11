import { clipsRepo, hooksRepo, rendersRepo, batchesRepo } from "@rotation/db";
import {
  getObjectStream,
  uploadStream,
  R2_PREFIX,
  outputFilename,
  type RenderJob,
} from "@rotation/shared";
import { createReadStream } from "node:fs";
import { compositeReel, extractThumbnail } from "../composite.js";
import { renderHookPng } from "../overlay/renderHookPng.js";
import {
  withTmpDir,
  streamToFile,
  bufferToFile,
  joinPath,
} from "../util/tmp.js";

/**
 * One render = one clip x one hook. Steps:
 *   1. pull the original clip from R2
 *   2. render the hook caption to a full-frame transparent PNG
 *   3. ffmpeg: cover-crop to 1080x1920, composite the caption, encode H.264
 *   4. upload the result to R2 and mark the render complete
 * Center-crop is used for the resize (flagged as an open question — may need
 * manual crop-position control for some footage later).
 */
export async function processRender(job: RenderJob): Promise<void> {
  const render = await rendersRepo.getRenderScoped(job.labelId, job.renderId);
  if (!render) return;

  const [clip, hook] = await Promise.all([
    clipsRepo.getClipScoped(job.labelId, render.clip_id),
    hooksRepo.getHook(job.labelId, render.hook_id),
  ]);
  if (!clip || !hook) {
    await rendersRepo.failRender(render.id, "Clip or hook no longer exists");
    await batchesRepo.refreshBatchStatus(render.batch_id);
    return;
  }

  await rendersRepo.claimRenderProcessing(render.id);

  try {
    const outName = outputFilename(clip.original_filename, hook.text);
    const outKey = R2_PREFIX.output(
      job.labelId,
      render.batch_id,
      render.id,
      outName
    );

    const thumbKey = outKey.replace(/\.mp4$/i, "_thumb.jpg");
    let thumbUploaded = false;

    await withTmpDir(async (dir) => {
      const inPath = joinPath(dir, "input");
      const pngPath = joinPath(dir, "hook.png");
      const outPath = joinPath(dir, outName);
      const thumbPath = joinPath(dir, "thumb.jpg");

      // 1. source
      await streamToFile(await getObjectStream(clip.r2_key_original), inPath);
      // 2. caption overlay (per-render caption style)
      await bufferToFile(renderHookPng(hook.text, render.caption_style), pngPath);
      // 3. composite + encode (crop anchor + HDR flag both come from probe)
      await compositeReel(inPath, pngPath, outPath, {
        anchor: { x: clip.crop_anchor_x, y: clip.crop_anchor_y },
        hdr: clip.is_hdr,
      });
      // 4. upload output — stream from disk (never buffer the whole MP4 in
      // memory; two concurrent large reels could otherwise OOM the worker).
      await uploadStream(outKey, createReadStream(outPath), "video/mp4");
      // 5. thumbnail (best-effort — a missing thumb shouldn't fail the render)
      try {
        await extractThumbnail(outPath, thumbPath);
        await uploadStream(thumbKey, createReadStream(thumbPath), "image/jpeg");
        thumbUploaded = true;
      } catch (err) {
        console.warn(
          `[render] thumbnail failed for ${render.id}:`,
          (err as Error).message
        );
      }
    });

    await rendersRepo.completeRender(
      render.id,
      outKey,
      thumbUploaded ? thumbKey : null
    );
  } catch (err) {
    // Deliberately do NOT mark the render failed here: BullMQ may still
    // auto-retry this job. Marking it 'failed' now would (a) flip the batch
    // out of 'processing' prematurely and (b) enable the manual Retry button
    // while an automatic retry is still in flight — the two would then render
    // the same clip×hook concurrently. The queue's 'failed' handler reconciles
    // the DB once, only after attempts are exhausted (see markRenderFailedFinal).
    throw err;
  }

  await batchesRepo.refreshBatchStatus(render.batch_id);
}

/**
 * Reconcile the DB after BullMQ has exhausted a render job's attempts (or it
 * stalled past recovery, e.g. the worker was killed mid-encode). Called from
 * the queue 'failed' handler on the final attempt only, so it never races an
 * in-flight auto-retry. No-op if the render vanished or already completed.
 */
export async function markRenderFailedFinal(
  job: RenderJob,
  message: string
): Promise<void> {
  const render = await rendersRepo.getRenderScoped(job.labelId, job.renderId);
  if (!render || render.status === "complete") return;
  await rendersRepo.failRender(render.id, message);
  await batchesRepo.refreshBatchStatus(render.batch_id);
}
