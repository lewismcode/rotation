import { clipsRepo, hooksRepo, rendersRepo, batchesRepo } from "@rotation/db";
import {
  getObjectStream,
  putObject,
  R2_PREFIX,
  outputFilename,
  type RenderJob,
} from "@rotation/shared";
import { readFile } from "node:fs/promises";
import { compositeReel, extractThumbnail } from "../composite.js";
import { probeFile, isHdr } from "../ffmpeg.js";
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
      // 1b. detect HDR (PQ/HLG/BT.2020) so we can tone-map to SDR
      const hdr = isHdr(await probeFile(inPath));
      // 2. caption overlay (per-render caption style)
      await bufferToFile(renderHookPng(hook.text, render.caption_style), pngPath);
      // 3. composite + encode (honoring the clip's manual crop anchor + HDR)
      await compositeReel(inPath, pngPath, outPath, {
        anchor: { x: clip.crop_anchor_x, y: clip.crop_anchor_y },
        hdr,
      });
      // 4. upload output
      await putObject(outKey, await readFile(outPath), "video/mp4");
      // 5. thumbnail (best-effort — a missing thumb shouldn't fail the render)
      try {
        await extractThumbnail(outPath, thumbPath);
        await putObject(thumbKey, await readFile(thumbPath), "image/jpeg");
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
    const message = err instanceof Error ? err.message : String(err);
    await rendersRepo.failRender(render.id, message);
    await batchesRepo.refreshBatchStatus(render.batch_id);
    throw err;
  }

  await batchesRepo.refreshBatchStatus(render.batch_id);
}
