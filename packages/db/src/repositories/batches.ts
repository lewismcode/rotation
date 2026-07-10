import { query } from "../client.js";
import type { Batch, BatchStatus, Clip, Render } from "@rotation/shared";

export async function createBatch(input: {
  labelId: string;
  createdByUserId: string;
}): Promise<Batch> {
  const { rows } = await query<Batch>(
    `INSERT INTO batches (label_id, created_by_user_id, status)
     VALUES ($1, $2, 'uploading') RETURNING *`,
    [input.labelId, input.createdByUserId]
  );
  return rows[0]!;
}

export async function getBatch(labelId: string, id: string): Promise<Batch | null> {
  const { rows } = await query<Batch>(
    "SELECT * FROM batches WHERE id = $1 AND label_id = $2",
    [id, labelId]
  );
  return rows[0] ?? null;
}

export async function listBatches(labelId: string): Promise<Batch[]> {
  const { rows } = await query<Batch>(
    "SELECT * FROM batches WHERE label_id = $1 ORDER BY created_at DESC LIMIT 50",
    [labelId]
  );
  return rows;
}

export async function setBatchStatus(
  labelId: string,
  id: string,
  status: BatchStatus
): Promise<void> {
  await query("UPDATE batches SET status = $3 WHERE id = $1 AND label_id = $2", [
    id,
    labelId,
    status,
  ]);
}

/**
 * Recompute a batch's status from its renders. Called by the worker after each
 * render completes so the batch flips to complete/failed without a separate
 * bookkeeping path.
 */
export async function refreshBatchStatus(batchId: string): Promise<BatchStatus> {
  const { rows } = await query<{
    total: string;
    done: string;
    failed: string;
  }>(
    `SELECT
        count(*) AS total,
        count(*) FILTER (WHERE status = 'complete') AS done,
        count(*) FILTER (WHERE status = 'failed') AS failed
     FROM renders WHERE batch_id = $1`,
    [batchId]
  );
  const total = Number(rows[0]?.total ?? 0);
  const done = Number(rows[0]?.done ?? 0);
  const failed = Number(rows[0]?.failed ?? 0);

  let status: BatchStatus = "processing";
  if (total > 0 && done + failed >= total) {
    status = failed === total ? "failed" : "complete";
  }
  await query("UPDATE batches SET status = $2 WHERE id = $1", [batchId, status]);
  return status;
}

/** Full batch detail used by the progress + delivery views. */
export async function getBatchDetail(
  labelId: string,
  batchId: string
): Promise<{ batch: Batch; clips: Clip[]; renders: Render[] } | null> {
  const batch = await getBatch(labelId, batchId);
  if (!batch) return null;
  const clips = (
    await query<Clip>(
      "SELECT * FROM clips WHERE batch_id = $1 ORDER BY created_at ASC",
      [batchId]
    )
  ).rows;
  const renders = (
    await query<Render>(
      "SELECT * FROM renders WHERE batch_id = $1 ORDER BY created_at ASC",
      [batchId]
    )
  ).rows;
  return { batch, clips, renders };
}
