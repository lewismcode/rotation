"use client";

import { Fragment, useState } from "react";
import type { Clip, Hook, Render, RenderStatus } from "@rotation/shared/types";
import { LIMITS } from "@rotation/shared/constants";
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
  onRetried,
}: {
  clips: Clip[];
  hooks: Hook[];
  renders: Render[];
  onRetried?: () => void;
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

      {/* failed renders — one-click retry per clip x hook */}
      {failed > 0 ? (
        <FailedList
          renders={renders.filter((r) => r.status === "failed")}
          clipById={new Map(clips.map((c) => [c.id, c]))}
          hookNumberById={new Map(cols.map((h, i) => [h.id, i + 1]))}
          onRetried={onRetried}
        />
      ) : null}

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

/**
 * The failed-render list under the matrix. Each row is one clip x hook that
 * errored, with a one-click Retry that re-enqueues just that pairing. Once a
 * render has burned through its retries we stop offering the button and point
 * the user at support instead of letting them spin on a broken clip.
 */
function FailedList({
  renders,
  clipById,
  hookNumberById,
  onRetried,
}: {
  renders: Render[];
  clipById: Map<string, Clip>;
  hookNumberById: Map<string, number>;
  onRetried?: () => void;
}) {
  return (
    <div className="space-y-2 border-t border-[var(--glass-border)] pt-4">
      <span className="data text-xs" style={{ color: "#d98b6a" }}>
        {renders.length} failed
      </span>
      <ul className="space-y-1.5">
        {renders.map((r) => {
          const clip = clipById.get(r.clip_id);
          const hookNo = hookNumberById.get(r.hook_id);
          const exhausted = r.retry_count >= LIMITS.MAX_RENDER_RETRIES;
          return (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0">
                <span className="data truncate text-secondary">
                  {clip ? stemOf(clip.original_filename) : "clip"}
                  {hookNo ? ` · hook ${hookNo}` : ""}
                </span>
                {r.error_message ? (
                  <span
                    className="block truncate text-faint"
                    title={r.error_message}
                  >
                    {r.error_message}
                  </span>
                ) : null}
              </div>
              {exhausted ? (
                <span className="shrink-0 text-faint">contact support</span>
              ) : (
                <RetryButton renderId={r.id} onRetried={onRetried} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RetryButton({
  renderId,
  onRetried,
}: {
  renderId: string;
  onRetried?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function retry() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/renders/${renderId}/retry`, {
        method: "POST",
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "Retry failed");
      }
      onRetried?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={retry}
      disabled={busy}
      title={err ?? undefined}
      className={`shrink-0 rounded-md border px-3 py-1 text-xs disabled:opacity-50 ${
        err
          ? "border-[#c0553a] text-[#c0553a]"
          : "border-border text-primary hover:border-accent"
      }`}
    >
      {busy ? "…" : err ? "Try again" : "Retry"}
    </button>
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
