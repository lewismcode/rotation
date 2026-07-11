import { query } from "../client.js";
import type { Hook } from "@rotation/shared";

export async function listHooks(
  labelId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<Hook[]> {
  const where = opts.activeOnly
    ? "WHERE label_id = $1 AND is_active = true"
    : "WHERE label_id = $1";
  const { rows } = await query<Hook>(
    `SELECT * FROM hooks ${where} ORDER BY created_at DESC`,
    [labelId]
  );
  return rows;
}

export async function getHook(labelId: string, id: string): Promise<Hook | null> {
  const { rows } = await query<Hook>(
    "SELECT * FROM hooks WHERE id = $1 AND label_id = $2",
    [id, labelId]
  );
  return rows[0] ?? null;
}

/** Resolve a set of hook ids but only within this label (defends fan-out). */
export async function getHooksByIds(
  labelId: string,
  ids: string[]
): Promise<Hook[]> {
  if (ids.length === 0) return [];
  const { rows } = await query<Hook>(
    "SELECT * FROM hooks WHERE label_id = $1 AND id = ANY($2::uuid[])",
    [labelId, ids]
  );
  return rows;
}

export async function createHook(input: {
  labelId: string;
  text: string;
  createdBy: string | null;
}): Promise<Hook> {
  const { rows } = await query<Hook>(
    `INSERT INTO hooks (label_id, text, created_by) VALUES ($1, $2, $3) RETURNING *`,
    [input.labelId, input.text, input.createdBy]
  );
  return rows[0]!;
}

/**
 * Insert any of `texts` the label doesn't already have (matched by trimmed
 * text). Idempotent — safe to call repeatedly. Returns the newly created hooks.
 */
export async function addMissingHooks(
  labelId: string,
  texts: string[],
  createdBy: string | null = null
): Promise<Hook[]> {
  const existing = await listHooks(labelId);
  const have = new Set(existing.map((h) => h.text.trim()));
  const created: Hook[] = [];
  for (const text of texts) {
    const t = text.trim();
    if (!t || have.has(t)) continue;
    created.push(await createHook({ labelId, text: t, createdBy }));
    have.add(t);
  }
  return created;
}

export async function updateHook(
  labelId: string,
  id: string,
  patch: { text?: string; isActive?: boolean }
): Promise<Hook | null> {
  const { rows } = await query<Hook>(
    `UPDATE hooks
       SET text = COALESCE($3, text),
           is_active = COALESCE($4, is_active)
     WHERE id = $1 AND label_id = $2
     RETURNING *`,
    [id, labelId, patch.text ?? null, patch.isActive ?? null]
  );
  return rows[0] ?? null;
}
