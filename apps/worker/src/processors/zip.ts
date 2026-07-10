import archiver from "archiver";
import { PassThrough } from "node:stream";
import { rendersRepo, clipsRepo, hooksRepo } from "@rotation/db";
import {
  getObjectStream,
  putObject,
  R2_PREFIX,
  outputFilename,
  type ZipJob,
} from "@rotation/shared";

/**
 * Build a single .zip of every completed render in a batch and upload it back
 * to R2 at a deterministic key, so the delivery view can hand out a presigned
 * link. Streams each render out of R2 straight into the archive — never buffers
 * a whole batch in memory.
 */
export async function processZip(job: ZipJob): Promise<string> {
  const renders = await rendersRepo.listCompleteRenders(job.batchId);
  const zipKey = R2_PREFIX.zip(job.labelId, job.batchId);

  const archive = archiver("zip", { zlib: { level: 6 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);

  // Kick off the R2 upload consuming the archive stream.
  const uploadPromise = putObject(zipKey, passthrough, "application/zip");

  archive.on("warning", (err) => console.warn("[zip] warning", err));

  const seen = new Set<string>();
  for (const render of renders) {
    if (!render.r2_key_output) continue;
    const [clip, hook] = await Promise.all([
      clipsRepo.getClipScoped(job.labelId, render.clip_id),
      hooksRepo.getHook(job.labelId, render.hook_id),
    ]);
    if (!clip || !hook) continue;

    let name = outputFilename(clip.original_filename, hook.text);
    // Guard against duplicate names within the zip.
    if (seen.has(name)) name = `${render.id.slice(0, 8)}__${name}`;
    seen.add(name);

    const stream = await getObjectStream(render.r2_key_output);
    archive.append(stream, { name });
  }

  await archive.finalize();
  await uploadPromise;
  return zipKey;
}
