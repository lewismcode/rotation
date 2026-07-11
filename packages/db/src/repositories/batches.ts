import { query } from "../client.js";
import type { Batch, BatchStatus, Clip, Render } from "@rotation/shared";

/**
 * Optional creator scope. Admins pass nothing (whole label); artists pass their
 * own user id so they only ever see/act on their own batches.
 */
export interface CreatorScope {
  createdByUserId?: string;
}

export async function createBatch(input: {
  labelId: string;
  createdByUserId: string;
}): Promise<Batch> {
  const { rows } = await query<Batch>(
    `INSERT INTO batches (label_id, created_by_user_id, status, label_seq)
     VALUES ($1, $2, 'uploading',
             (SELECT COALESCE(MAX(label_seq), 0) + 1 FROM batches WHERE label_id = $1))
     RETURNING *`,
    [input.labelId, input.createdByUserId]
  );
  return rows[0]!;
}

export async function getBatch(
  labelId: string,
  id: string,
  scope: CreatorScope = {}
): Promise<Batch | null> {
  const { rows } = await query<Batch>(
    `SELECT * FROM batches
     WHERE id = $1 AND label_id = $2
       AND ($3::uuid IS NULL OR created_by_user_id = $3)`,
    [id, labelId, scope.createdByUserId ?? null]
  );
  return rows[0] ?? null;
}

export async function listBatches(
  labelId: string,
  scope: CreatorScope = {}
): Promise<Batch[]> {
  const { rows } = await query<Batch>(
    `SELECT * FROM batches
     WHERE label_id = $1
       AND ($2::uuid IS NULL OR created_by_user_id = $2)
     ORDER BY created_at DESC LIMIT 50`,
    [labelId, scope.createdByUserId ?? null]
  );
  return rows;
}

export async function renameBatch(
  labelId: string,
  id: string,
  name: string | null,
  scope: CreatorScope = {}
): Promise<Batch | null> {
  const clean = name?.trim() ? name.trim().slice(0, 80) : null;
  const { rows } = await query<Batch>(
    `UPDATE batches SET name = $3
     WHERE id = $1 AND label_id = $2
       AND ($4::uuid IS NULL OR created_by_user_id = $4)
     RETURNING *`,
    [id, labelId, clean, scope.createdByUserId ?? null]
  );
  return rows[0] ?? null;
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
  batchId: string,
  scope: CreatorScope = {}
): Promise<{ batch: Batch; clips: Clip[]; renders: Render[] } | null> {
  const batch = await getBatch(labelId, batchId, scope);
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
