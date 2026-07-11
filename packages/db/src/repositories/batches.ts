import { query, tx } from "../client.js";
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
     WHERE id = $1 AND label_id = $2 AND archived_at IS NULL
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
     WHERE label_id = $1 AND archived_at IS NULL
       AND ($2::uuid IS NULL OR created_by_user_id = $2)
     ORDER BY created_at DESC LIMIT 50`,
    [labelId, scope.createdByUserId ?? null]
  );
  return rows;
}

/** Soft-delete: hide the batch; R2 objects retained until the retention purge. */
export async function archiveBatch(
  labelId: string,
  id: string,
  scope: CreatorScope = {}
): Promise<Batch | null> {
  const { rows } = await query<Batch>(
    `UPDATE batches SET archived_at = now()
     WHERE id = $1 AND label_id = $2 AND archived_at IS NULL
       AND ($3::uuid IS NULL OR created_by_user_id = $3)
     RETURNING *`,
    [id, labelId, scope.createdByUserId ?? null]
  );
  return rows[0] ?? null;
}

/** Un-archive within the retention window. */
export async function restoreBatch(
  labelId: string,
  id: string,
  scope: CreatorScope = {}
): Promise<Batch | null> {
  const { rows } = await query<Batch>(
    `UPDATE batches SET archived_at = NULL
     WHERE id = $1 AND label_id = $2 AND archived_at IS NOT NULL
       AND ($3::uuid IS NULL OR created_by_user_id = $3)
     RETURNING *`,
    [id, labelId, scope.createdByUserId ?? null]
  );
  return rows[0] ?? null;
}

/** Batches archived longer than the retention window — ready to hard-delete. */
export async function listExpiredArchivedBatches(
  retentionDays: number
): Promise<Array<{ id: string; label_id: string }>> {
  const { rows } = await query<{ id: string; label_id: string }>(
    `SELECT id, label_id FROM batches
     WHERE archived_at IS NOT NULL
       AND archived_at < now() - ($1::int || ' days')::interval`,
    [retentionDays]
  );
  return rows;
}

/** Hard delete (cascades clips + renders). Used only by the retention purge. */
export async function hardDeleteBatch(id: string): Promise<void> {
  await query("DELETE FROM batches WHERE id = $1", [id]);
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
/**
 * Recompute a batch's status from its renders' statuses. Serialized per batch:
 * two renders finishing at once would otherwise race (read-then-write), and a
 * stale count could overwrite a 'complete' with 'processing', wedging a fully
 * rendered batch forever. Locking the batch row FOR UPDATE makes each caller
 * count after the previous one has committed, so the last finisher always wins.
 */
export async function refreshBatchStatus(batchId: string): Promise<BatchStatus> {
  return tx(async (client) => {
    // Serialize concurrent refreshes for this batch.
    await client.query("SELECT id FROM batches WHERE id = $1 FOR UPDATE", [
      batchId,
    ]);
    const { rows } = await client.query<{
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
    await client.query("UPDATE batches SET status = $2 WHERE id = $1", [
      batchId,
      status,
    ]);
    return status;
  });
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
