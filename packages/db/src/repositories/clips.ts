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
    "SELECT * FROM clips WHERE batch_id = $1 ORDER BY created_at ASC",
    [batchId]
  );
  return rows;
}

/** Fetch a clip and verify it belongs to the label (join through batch). */
export async function getClipScoped(
  labelId: string,
  clipId: string
): Promise<Clip | null> {
  const { rows } = await query<Clip>(
    `SELECT c.* FROM clips c
       JOIN batches b ON b.id = c.batch_id
     WHERE c.id = $1 AND b.label_id = $2`,
    [clipId, labelId]
  );
  return rows[0] ?? null;
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
