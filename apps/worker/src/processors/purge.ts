import { batchesRepo, clipsRepo, rendersRepo } from "@rotation/db";
import {
  deleteObject,
  R2_PREFIX,
  ARCHIVE_RETENTION_DAYS,
} from "@rotation/shared";

/**
 * Retention purge: archived batches (and standalone-archived clips) older than
 * ARCHIVE_RETENTION_DAYS get their R2 objects deleted and their rows hard
 * removed. Runs on a schedule; idempotent and safe to run repeatedly.
 */
export async function processPurge(): Promise<{ batches: number; clips: number }> {
  const days = ARCHIVE_RETENTION_DAYS;
  let purgedBatches = 0;
  let purgedClips = 0;

  const batches = await batchesRepo.listExpiredArchivedBatches(days);
  for (const b of batches) {
    try {
      const [clipKeys, outputKeys] = await Promise.all([
        clipsRepo.listAllClipKeys(b.id),
        rendersRepo.listOutputKeys(b.id),
      ]);
      const keys = [
        ...clipKeys,
        ...outputKeys,
        R2_PREFIX.zip(b.label_id, b.id),
      ];
      await Promise.allSettled(keys.map((k) => deleteObject(k)));
      await batchesRepo.hardDeleteBatch(b.id); // cascades clips + renders
      purgedBatches++;
    } catch (err) {
      console.error(`[purge] batch ${b.id} failed:`, (err as Error).message);
    }
  }

  const clips = await clipsRepo.listExpiredArchivedClips(days);
  for (const c of clips) {
    try {
      await deleteObject(c.r2_key_original).catch(() => {});
      await clipsRepo.hardDeleteClip(c.id);
      purgedClips++;
    } catch (err) {
      console.error(`[purge] clip ${c.id} failed:`, (err as Error).message);
    }
  }

  if (purgedBatches || purgedClips) {
    console.log(
      `[purge] removed ${purgedBatches} batches, ${purgedClips} clips (retention ${days}d)`
    );
  }
  return { batches: purgedBatches, clips: purgedClips };
}
