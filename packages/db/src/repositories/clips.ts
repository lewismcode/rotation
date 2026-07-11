import { query } from "../client.js";
import type { Clip, ClipStatus } from "@rotation/shared";

export async function createClip(input: {
  id?: string;
  batchId: string;
  originalFilename: string;
  r2KeyOriginal: string;
}): Promise<Clip> {
  const { rows } = await query<Clip>(
    `INSERT INTO clips (id, batch_id, original_filename, r2_key_original, status)
     VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, 'uploading') RETURNING *`,
    [input.id ?? null, input.batchId, input.originalFilename, input.r2KeyOriginal]
  );
  return rows[0]!;
}

export async function listClips(batchId: string): Promise<Clip[]> {
  const { rows } = await query<Clip>(
    "SELECT * FROM clips WHERE batch_id = $1 AND archived_at IS NULL ORDER BY created_at ASC",
    [batchId]
  );
  return rows;
}

/** All R2 keys for a batch's clips, archived included — for the purge. */
export async function listAllClipKeys(batchId: string): Promise<string[]> {
  const { rows } = await query<{ r2_key_original: string }>(
    "SELECT r2_key_original FROM clips WHERE batch_id = $1",
    [batchId]
  );
  return rows.map((r) => r.r2_key_original);
}

/** Fetch a clip and verify it belongs to the label (join through batch). */
export async function getClipScoped(
  labelId: string,
  clipId: string
): Promise<Clip | null> {
  const { rows } = await query<Clip>(
    `SELECT c.* FROM clips c
       JOIN batches b ON b.id = c.batch_id
     WHERE c.id = $1 AND b.label_id = $2 AND c.archived_at IS NULL`,
    [clipId, labelId]
  );
  return rows[0] ?? null;
}

/** Soft-delete a single clip (removing an upload before generating). */
export async function archiveClip(
  labelId: string,
  clipId: string,
  createdByUserId?: string
): Promise<{ id: string; r2_key_original: string } | null> {
  const { rows } = await query<{ id: string; r2_key_original: string }>(
    `UPDATE clips c SET archived_at = now()
       FROM batches b
     WHERE c.id = $1 AND c.batch_id = b.id AND b.label_id = $2
       AND c.archived_at IS NULL
       AND ($3::uuid IS NULL OR b.created_by_user_id = $3)
     RETURNING c.id, c.r2_key_original`,
    [clipId, labelId, createdByUserId ?? null]
  );
  return rows[0] ?? null;
}

/** Standalone-archived clips past retention (their batch wasn't archived). */
export async function listExpiredArchivedClips(
  retentionDays: number
): Promise<Array<{ id: string; r2_key_original: string }>> {
  const { rows } = await query<{ id: string; r2_key_original: string }>(
    `SELECT c.id, c.r2_key_original
     FROM clips c JOIN batches b ON b.id = c.batch_id
     WHERE c.archived_at IS NOT NULL
       AND b.archived_at IS NULL
       AND c.archived_at < now() - ($1::int || ' days')::interval`,
    [retentionDays]
  );
  return rows;
}

export async function hardDeleteClip(id: string): Promise<void> {
  await query("DELETE FROM clips WHERE id = $1", [id]);
}

export async function setClipProbe(
  clipId: string,
  data: {
    width: number;
    height: number;
    durationSeconds: number;
    needsResize: boolean;
  }
): Promise<void> {
  await query(
    `UPDATE clips
       SET width = $2, height = $3, duration_seconds = $4,
           needs_resize = $5, status = 'ready'
     WHERE id = $1`,
    [clipId, data.width, data.height, data.durationSeconds, data.needsResize]
  );
}

export async function setClipStatus(
  clipId: string,
  status: ClipStatus
): Promise<void> {
  await query("UPDATE clips SET status = $2 WHERE id = $1", [clipId, status]);
}
