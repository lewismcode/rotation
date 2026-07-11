"use client";

import { Fragment } from "react";
import type { Clip, Hook, Render, RenderStatus } from "@rotation/shared/types";
import { stemOf } from "@rotation/shared/slug";

/**
 * The signature view: a live matrix of clips (rows) × hooks (columns), each cell
 * one render lighting up as it completes. Columns are numbered and mapped to
 * hook text in the legend below, so long hooks stay readable.
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

  const clipIds = new Set(renders.map((r) => r.clip_id));
  const hookIds = new Set(renders.map((r) => r.hook_id));
  const rows = clips.filter((c) => clipIds.has(c.id));
  const cols = hooks.filter((h) => hookIds.has(h.id));

  const byPair = new Map<string, Render>();
  for (const r of renders) byPair.set(`${r.clip_id}:${r.hook_id}`, r);

  const done = renders.filter((r) => r.status === "complete").length;
  const failed = renders.filter((r) => r.status === "failed").length;
  const pct = Math.round((done / renders.length) * 100);

  return (
    <div className="space-y-5">
      {/* progress */}
      <div>
        <div className="mb-2 flex items-center justify-between">
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
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--glass-border)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: "var(--complete)" }}
          />
        </div>
      </div>

      {/* matrix */}
      <div className="overflow-x-auto pb-1">
        <div
          className="inline-grid items-center gap-2"
          style={{
            gridTemplateColumns: `minmax(110px, 1fr) repeat(${cols.length}, 40px)`,
          }}
        >
          <div />
          {cols.map((h, i) => (
            <div
              key={h.id}
              className="data text-center text-[11px] text-faint"
              title={h.text}
            >
              {i + 1}
            </div>
          ))}

          {rows.map((clip) => (
            <Fragment key={clip.id}>
              <div
                className="data truncate pr-3 text-xs text-secondary"
                title={clip.original_filename}
              >
                {stemOf(clip.original_filename)}
              </div>
              {cols.map((hook) => (
                <Cell
                  key={hook.id}
                  status={byPair.get(`${clip.id}:${hook.id}`)?.status ?? "queued"}
                />
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      {/* legend */}
      <ol className="space-y-1.5 border-t border-[var(--glass-border)] pt-4">
        {cols.map((h, i) => (
          <li key={h.id} className="flex items-start gap-2.5 text-xs">
            <span
              className="data mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px]"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {i + 1}
            </span>
            <span className="text-secondary">{h.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Cell({ status }: { status: RenderStatus }) {
  const base =
    "grid h-10 w-10 place-items-center rounded-[10px] border transition-all";
  if (status === "complete") {
    return (
      <div
        className={`${base} cell-complete`}
        style={{ background: "var(--complete)", borderColor: "var(--complete)" }}
        title="complete"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
    );
  }
  if (status === "processing") {
    return (
      <div
        className={`${base} animate-pulse`}
        style={{
          background: "var(--accent-soft)",
          borderColor: "var(--accent)",
        }}
        title="rendering"
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--accent)" }}
        />
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div
        className={base}
        style={{ background: "transparent", borderColor: "#c0553a", color: "#c0553a" }}
        title="failed"
      >
        <span className="text-sm leading-none">×</span>
      </div>
    );
  }
  return (
    <div
      className={base}
      style={{ background: "transparent", borderColor: "var(--glass-border)" }}
      title="queued"
    />
  );
}
