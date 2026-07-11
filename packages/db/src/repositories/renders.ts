import { query, tx } from "../client.js";
import { LIMITS, type Render, type RenderStatus } from "@rotation/shared";

/**
 * Fan-out: create one render row per clip x hook, all queued, in a single
 * transaction. Returns the created rows so the caller can enqueue jobs.
 * ON CONFLICT DO NOTHING makes re-confirming a batch idempotent.
 */
export async function createRenders(
  batchId: string,
  pairs: Array<{ clipId: string; hookId: string }>,
  captionStyle = "poster"
): Promise<Render[]> {
  if (pairs.length === 0) return [];
  return tx(async (client) => {
    const created: Render[] = [];
    for (const { clipId, hookId } of pairs) {
      const { rows } = await client.query<Render>(
        `INSERT INTO renders (batch_id, clip_id, hook_id, status, caption_style)
         VALUES ($1, $2, $3, 'queued', $4)
         ON CONFLICT (batch_id, clip_id, hook_id) DO NOTHING
         RETURNING *`,
        [batchId, clipId, hookId, captionStyle]
      );
      if (rows[0]) created.push(rows[0]);
    }
    return created;
  });
}

/**
 * Fetch a render joined to its batch for label scoping. Pass createdByUserId to
 * additionally restrict to a single creator (artists can only reach their own
 * renders; admins pass undefined to see the whole label).
 */
export async function getRenderScoped(
  labelId: string,
  renderId: string,
  createdByUserId?: string
): Promise<Render | null> {
  const { rows } = await query<Render>(
    `SELECT r.* FROM renders r
       JOIN batches b ON b.id = r.batch_id
     WHERE r.id = $1 AND b.label_id = $2
       AND ($3::uuid IS NULL OR b.created_by_user_id = $3)`,
    [renderId, labelId, createdByUserId ?? null]
  );
  return rows[0] ?? null;
}

export async function claimRenderProcessing(renderId: string): Promise<void> {
  await query(
    "UPDATE renders SET status = 'processing' WHERE id = $1 AND status != 'complete'",
    [renderId]
  );
}

export async function completeRender(
  renderId: string,
  r2KeyOutput: string,
  thumbnailKey: string | null = null
): Promise<void> {
  await query(
    `UPDATE renders
       SET status = 'complete', r2_key_output = $2, thumbnail_r2_key = $3,
           error_message = NULL, completed_at = now()
     WHERE id = $1`,
    [renderId, r2KeyOutput, thumbnailKey]
  );
}

export async function failRender(
  renderId: string,
  message: string
): Promise<void> {
  await query(
    `UPDATE renders
       SET status = 'failed', error_message = $2, completed_at = now()
     WHERE id = $1`,
    [renderId, message.slice(0, 2000)]
  );
}

/**
 * Reset a failed render back to 'queued' so it can be re-rendered, bumping
 * retry_count. Only touches rows that are actually failed and still under the
 * retry cap — the guard is in the WHERE clause so it's race-safe (two clicks
 * can't double-enqueue or exceed the cap). Returns the updated row, or null if
 * the render wasn't eligible (not failed, or cap reached).
 */
export async function retryRender(
  labelId: string,
  renderId: string,
  createdByUserId?: string
): Promise<Render | null> {
  const { rows } = await query<Render>(
    `UPDATE renders r
       SET status = 'queued', error_message = NULL,
           retry_count = retry_count + 1, completed_at = NULL
      FROM batches b
     WHERE r.id = $1 AND r.batch_id = b.id AND b.label_id = $2
       AND ($4::uuid IS NULL OR b.created_by_user_id = $4)
       AND r.status = 'failed' AND r.retry_count < $3
     RETURNING r.*`,
    [renderId, labelId, LIMITS.MAX_RENDER_RETRIES, createdByUserId ?? null]
  );
  return rows[0] ?? null;
}

export async function setRenderStatus(
  renderId: string,
  status: RenderStatus
): Promise<void> {
  await query("UPDATE renders SET status = $2 WHERE id = $1", [renderId, status]);
}

/** Total render rows already created for a batch (for the cumulative cap). */
export async function countRenders(batchId: string): Promise<number> {
  const { rows } = await query<{ n: string }>(
    "SELECT count(*) AS n FROM renders WHERE batch_id = $1",
    [batchId]
  );
  return Number(rows[0]?.n ?? 0);
}

/** Completed renders for a batch — used to build the zip. */
export async function listCompleteRenders(batchId: string): Promise<Render[]> {
  const { rows } = await query<Render>(
    "SELECT * FROM renders WHERE batch_id = $1 AND status = 'complete'",
    [batchId]
  );
  return rows;
}

/** All output + thumbnail R2 keys for a batch — for the retention purge. */
export async function listOutputKeys(batchId: string): Promise<string[]> {
  const { rows } = await query<{
    r2_key_output: string | null;
    thumbnail_r2_key: string | null;
  }>(
    "SELECT r2_key_output, thumbnail_r2_key FROM renders WHERE batch_id = $1",
    [batchId]
  );
  const keys: string[] = [];
  for (const r of rows) {
    if (r.r2_key_output) keys.push(r.r2_key_output);
    if (r.thumbnail_r2_key) keys.push(r.thumbnail_r2_key);
  }
  return keys;
}
