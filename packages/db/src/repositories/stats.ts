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
    status: BatchStatus;
    created_at: string;
    clip_count: number;
    render_total: number;
    render_complete: number;
  }>;
  topHooks: Array<{ id: string; text: string; uses: number }>;
}

/** Everything the overview dashboard shows, label-scoped, in a few queries. */
export async function getDashboard(labelId: string): Promise<DashboardStats> {
  const totals = await query<{
    reels: string;
    in_progress: string;
    batches: string;
    clips: string;
    active_hooks: string;
  }>(
    `SELECT
       (SELECT count(*) FROM renders r JOIN batches b ON b.id = r.batch_id
          WHERE b.label_id = $1 AND r.status = 'complete') AS reels,
       (SELECT count(*) FROM renders r JOIN batches b ON b.id = r.batch_id
          WHERE b.label_id = $1 AND r.status IN ('queued','processing')) AS in_progress,
       (SELECT count(*) FROM batches WHERE label_id = $1) AS batches,
       (SELECT count(*) FROM clips c JOIN batches b ON b.id = c.batch_id
          WHERE b.label_id = $1) AS clips,
       (SELECT count(*) FROM hooks WHERE label_id = $1 AND is_active) AS active_hooks`,
    [labelId]
  );

  const recent = await query<{
    id: string;
    status: BatchStatus;
    created_at: string;
    clip_count: string;
    render_total: string;
    render_complete: string;
  }>(
    `SELECT b.id, b.status, b.created_at,
       (SELECT count(*) FROM clips c WHERE c.batch_id = b.id) AS clip_count,
       (SELECT count(*) FROM renders r WHERE r.batch_id = b.id) AS render_total,
       (SELECT count(*) FROM renders r WHERE r.batch_id = b.id AND r.status = 'complete')
         AS render_complete
     FROM batches b
     WHERE b.label_id = $1
     ORDER BY b.created_at DESC
     LIMIT 5`,
    [labelId]
  );

  const topHooks = await query<{ id: string; text: string; uses: string }>(
    `SELECT h.id, h.text, count(r.id) AS uses
     FROM hooks h
     JOIN renders r ON r.hook_id = h.id
     JOIN batches b ON b.id = r.batch_id
     WHERE h.label_id = $1 AND b.label_id = $1
     GROUP BY h.id, h.text
     ORDER BY uses DESC
     LIMIT 5`,
    [labelId]
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
