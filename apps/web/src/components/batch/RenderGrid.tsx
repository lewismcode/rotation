"use client";

import type { Clip, Hook, Render, RenderStatus } from "@rotation/shared/types";
import { stemOf } from "@rotation/shared/slug";

/**
 * The signature view: a live matrix of clips (rows) × hooks (columns). Each cell
 * is one render; it lights up as that specific output completes. This is both
 * the functional visualization of the output matrix and the batch's progress
 * indicator — no separate progress bar.
 */
export function RenderGrid({
  clips,
  hooks,
  renders,
}: {
  clips: Clip[];
  hooks: Hook[];
  renders: Render[];
}) {
  if (renders.length === 0) {
    return (
      <p className="text-sm text-secondary">
        Renders will appear here once you generate.
      </p>
    );
  }

  // Only include clips/hooks that actually have renders in this batch.
  const clipIds = new Set(renders.map((r) => r.clip_id));
  const hookIds = new Set(renders.map((r) => r.hook_id));
  const rows = clips.filter((c) => clipIds.has(c.id));
  const cols = hooks.filter((h) => hookIds.has(h.id));

  const byPair = new Map<string, Render>();
  for (const r of renders) byPair.set(`${r.clip_id}:${r.hook_id}`, r);

  const done = renders.filter((r) => r.status === "complete").length;
  const failed = renders.filter((r) => r.status === "failed").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="data text-sm">
          <span style={{ color: "var(--complete)" }}>{done}</span>
          <span className="text-secondary"> / {renders.length} complete</span>
        </span>
        {failed > 0 ? (
          <span className="data text-xs" style={{ color: "#d98b6a" }}>
            {failed} failed
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: "6px" }}>
          <thead>
            <tr>
              <th className="w-40" />
              {cols.map((h) => (
                <th
                  key={h.id}
                  className="data max-w-[120px] px-1 pb-1 text-left align-bottom text-[10px] font-normal text-secondary"
                >
                  <span className="line-clamp-2">{h.text}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((clip) => (
              <tr key={clip.id}>
                <td className="data max-w-[160px] truncate pr-2 text-xs text-secondary">
                  {stemOf(clip.original_filename)}
                </td>
                {cols.map((hook) => {
                  const r = byPair.get(`${clip.id}:${hook.id}`);
                  return (
                    <td key={hook.id}>
                      <Cell status={r?.status ?? "queued"} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ status }: { status: RenderStatus }) {
  const base =
    "h-8 w-8 rounded-[5px] border transition-all";
  if (status === "complete") {
    return (
      <div
        className={`${base} cell-complete`}
        style={{
          background: "var(--complete)",
          borderColor: "var(--complete)",
        }}
        title="complete"
      />
    );
  }
  if (status === "processing") {
    return (
      <div
        className={`${base} animate-pulse`}
        style={{
          background: "color-mix(in srgb, var(--accent) 40%, transparent)",
          borderColor: "var(--accent)",
        }}
        title="rendering"
      />
    );
  }
  if (status === "failed") {
    return (
      <div
        className={base}
        style={{ background: "transparent", borderColor: "#d98b6a" }}
        title="failed"
      />
    );
  }
  return (
    <div
      className={base}
      style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      title="queued"
    />
  );
}
