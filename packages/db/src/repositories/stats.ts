import { query } from "../client.js";
import type { BatchStatus } from "@rotation/shared";

export interface DashboardStats {
  reelsGenerated: number;
  rendersInProgress: number;
  batches: number;
  clips: number;
  activeHooks: number;
  recentBatches: Array<{
    id: string;
    name: string | null;
    label_seq: number | null;
    status: BatchStatus;
    created_at: string;
    clip_count: number;
    render_total: number;
    render_complete: number;
  }>;
  topHooks: Array<{ id: string; text: string; uses: number }>;
}

/**
 * Everything the overview dashboard shows. Pass createdByUserId to scope to a
 * single artist (their own numbers); omit for the whole label (admin view).
 * Active hooks are always label-wide (the hook library is shared).
 */
export async function getDashboard(
  labelId: string,
  createdByUserId?: string
): Promise<DashboardStats> {
  const uid = createdByUserId ?? null;
  const totals = await query<{
    reels: string;
    in_progress: string;
    batches: string;
    clips: string;
    active_hooks: string;
  }>(
    `SELECT
       (SELECT count(*) FROM renders r JOIN batches b ON b.id = r.batch_id
          WHERE b.label_id = $1 AND ($2::uuid IS NULL OR b.created_by_user_id = $2)
            AND r.status = 'complete') AS reels,
       (SELECT count(*) FROM renders r JOIN batches b ON b.id = r.batch_id
          WHERE b.label_id = $1 AND ($2::uuid IS NULL OR b.created_by_user_id = $2)
            AND r.status IN ('queued','processing')) AS in_progress,
       (SELECT count(*) FROM batches
          WHERE label_id = $1 AND ($2::uuid IS NULL OR created_by_user_id = $2)) AS batches,
       (SELECT count(*) FROM clips c JOIN batches b ON b.id = c.batch_id
          WHERE b.label_id = $1 AND ($2::uuid IS NULL OR b.created_by_user_id = $2)) AS clips,
       (SELECT count(*) FROM hooks WHERE label_id = $1 AND is_active) AS active_hooks`,
    [labelId, uid]
  );

  const recent = await query<{
    id: string;
    name: string | null;
    label_seq: number | null;
    status: BatchStatus;
    created_at: string;
    clip_count: string;
    render_total: string;
    render_complete: string;
  }>(
    `SELECT b.id, b.name, b.label_seq, b.status, b.created_at,
       (SELECT count(*) FROM clips c WHERE c.batch_id = b.id) AS clip_count,
       (SELECT count(*) FROM renders r WHERE r.batch_id = b.id) AS render_total,
       (SELECT count(*) FROM renders r WHERE r.batch_id = b.id AND r.status = 'complete')
         AS render_complete
     FROM batches b
     WHERE b.label_id = $1 AND ($2::uuid IS NULL OR b.created_by_user_id = $2)
     ORDER BY b.created_at DESC
     LIMIT 5`,
    [labelId, uid]
  );

  const topHooks = await query<{ id: string; text: string; uses: string }>(
    `SELECT h.id, h.text, count(r.id) AS uses
     FROM hooks h
     JOIN renders r ON r.hook_id = h.id
     JOIN batches b ON b.id = r.batch_id
     WHERE h.label_id = $1 AND b.label_id = $1
       AND ($2::uuid IS NULL OR b.created_by_user_id = $2)
     GROUP BY h.id, h.text
     ORDER BY uses DESC
     LIMIT 5`,
    [labelId, uid]
  );

  const t = totals.rows[0]!;
  return {
    reelsGenerated: Number(t.reels),
    rendersInProgress: Number(t.in_progress),
    batches: Number(t.batches),
    clips: Number(t.clips),
    activeHooks: Number(t.active_hooks),
    recentBatches: recent.rows.map((r) => ({
      id: r.id,
      name: r.name,
      label_seq: r.label_seq,
      status: r.status,
      created_at: r.created_at,
      clip_count: Number(r.clip_count),
      render_total: Number(r.render_total),
      render_complete: Number(r.render_complete),
    })),
    topHooks: topHooks.rows.map((h) => ({
      id: h.id,
      text: h.text,
      uses: Number(h.uses),
    })),
  };
}

export interface RosterRow {
  userId: string;
  clerkUserId: string;
  role: string;
  batches: number;
  reels: number;
  lastActive: string | null;
}

/** Per-member activity for the roster, joined to Clerk profiles by the caller. */
export async function getRoster(labelId: string): Promise<RosterRow[]> {
  const { rows } = await query<{
    id: string;
    clerk_user_id: string;
    role: string;
    batches: string;
    reels: string;
    last_active: string | null;
  }>(
    `SELECT u.id, u.clerk_user_id, u.role,
        count(DISTINCT b.id) AS batches,
        count(r.id) FILTER (WHERE r.status = 'complete') AS reels,
        max(b.created_at) AS last_active
     FROM users u
       LEFT JOIN batches b ON b.created_by_user_id = u.id
       LEFT JOIN renders r ON r.batch_id = b.id
     WHERE u.label_id = $1
     GROUP BY u.id
     ORDER BY reels DESC, last_active DESC NULLS LAST`,
    [labelId]
  );
  return rows.map((r) => ({
    userId: r.id,
    clerkUserId: r.clerk_user_id,
    role: r.role,
    batches: Number(r.batches),
    reels: Number(r.reels),
    lastActive: r.last_active,
  }));
}

/** Completed reels per day over the last `days`, zero-filled for a clean chart. */
export async function getActivity(
  labelId: string,
  days = 14,
  createdByUserId?: string
): Promise<Array<{ day: string; count: number }>> {
  const { rows } = await query<{ day: string; count: string }>(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(x.cnt, 0) AS count
     FROM generate_series(
            date_trunc('day', now()) - (($2::int - 1) || ' days')::interval,
            date_trunc('day', now()),
            '1 day'
          ) d
       LEFT JOIN (
         SELECT date_trunc('day', r.completed_at) AS day, count(*) AS cnt
         FROM renders r JOIN batches b ON b.id = r.batch_id
         WHERE b.label_id = $1 AND r.status = 'complete'
           AND ($3::uuid IS NULL OR b.created_by_user_id = $3)
         GROUP BY 1
       ) x ON x.day = d
     ORDER BY d`,
    [labelId, days, createdByUserId ?? null]
  );
  return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
}

/** Render count per caption style (usage breakdown). */
export async function getStyleBreakdown(
  labelId: string,
  createdByUserId?: string
): Promise<Array<{ style: string; count: number }>> {
  const { rows } = await query<{ style: string; count: string }>(
    `SELECT r.caption_style AS style, count(*) AS count
     FROM renders r JOIN batches b ON b.id = r.batch_id
     WHERE b.label_id = $1 AND ($2::uuid IS NULL OR b.created_by_user_id = $2)
     GROUP BY r.caption_style
     ORDER BY count DESC`,
    [labelId, createdByUserId ?? null]
  );
  return rows.map((r) => ({ style: r.style, count: Number(r.count) }));
}
