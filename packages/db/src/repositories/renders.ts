import { query, tx } from "../client.js";
import type { Render, RenderStatus } from "@rotation/shared";

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

/** Fetch a render joined to its batch for label scoping. */
export async function getRenderScoped(
  labelId: string,
  renderId: string
): Promise<Render | null> {
  const { rows } = await query<Render>(
    `SELECT r.* FROM renders r
       JOIN batches b ON b.id = r.batch_id
     WHERE r.id = $1 AND b.label_id = $2`,
    [renderId, labelId]
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

export async function setRenderStatus(
  renderId: string,
  status: RenderStatus
): Promise<void> {
  await query("UPDATE renders SET status = $2 WHERE id = $1", [renderId, status]);
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
