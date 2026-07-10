import { clipsRepo, hooksRepo, rendersRepo, batchesRepo } from "@rotation/db";
import {
  getObjectStream,
  putObject,
  R2_PREFIX,
  REELS,
  outputFilename,
  type RenderJob,
} from "@rotation/shared";
import { readFile } from "node:fs/promises";
import { ffmpeg } from "../ffmpeg.js";
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

    await withTmpDir(async (dir) => {
      const inPath = joinPath(dir, "input");
      const pngPath = joinPath(dir, "hook.png");
      const outPath = joinPath(dir, outName);

      // 1. source
      await streamToFile(await getObjectStream(clip.r2_key_original), inPath);
      // 2. caption overlay
      await bufferToFile(renderHookPng(hook.text), pngPath);
      // 3. composite + encode
      await runFfmpeg(inPath, pngPath, outPath);
      // 4. upload
      const bytes = await readFile(outPath);
      await putObject(outKey, bytes, "video/mp4");
    });

    await rendersRepo.completeRender(render.id, outKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await rendersRepo.failRender(render.id, message);
    await batchesRepo.refreshBatchStatus(render.batch_id);
    throw err;
  }

  await batchesRepo.refreshBatchStatus(render.batch_id);
}

/**
 * The single ffmpeg invocation. cover-crop then overlay:
 *   [0:v] scale to cover 1080x1920, center-crop, reset SAR   -> [base]
 *   [base][1:v] overlay caption png at 0,0                   -> [v]
 * Audio is passed through/re-encoded if present (0:a?).
 */
function runFfmpeg(
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
