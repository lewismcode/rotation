"use client";

import { useState } from "react";
import type { Hook } from "@rotation/shared/types";

/**
 * Multi-select the hooks to overlay. Shows the exact fan-out count before the
 * user commits ("12 clips × 3 hooks = 36 videos"). Confirming creates the
 * renders and kicks off processing.
 */
export function HooksStep({
  batchId,
  hooks,
  clipCount,
  locked,
  selectedHookIds,
  onConfirmed,
}: {
  batchId: string;
  hooks: Hook[];
  clipCount: number;
  locked: boolean;
  selectedHookIds: string[];
  onConfirmed: () => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(selectedHookIds)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const count = selected.size;
  const total = clipCount * count;

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hookIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "Could not start processing");
      }
      await onConfirmed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (hooks.length === 0) {
    return (
      <p className="text-sm text-secondary">
        No active hooks yet. An admin can add hooks in the Hooks library.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {hooks.map((hook) => {
          const isOn = selected.has(hook.id);
          return (
            <li key={hook.id}>
              <button
                type="button"
                onClick={() => toggle(hook.id)}
                disabled={locked}
                className="flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors"
                style={{
                  borderColor: isOn ? "var(--accent)" : "var(--border)",
                  background: isOn
                    ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                    : "transparent",
                  cursor: locked ? "default" : "pointer",
                }}
              >
                <span
                  className="grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px]"
                  style={{
                    borderColor: isOn ? "var(--accent)" : "var(--border)",
                    background: isOn ? "var(--accent)" : "transparent",
                    color: "#141310",
                  }}
                >
                  {isOn ? "✓" : ""}
                </span>
                <span className="text-sm text-primary">{hook.text}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between rounded-md border border-border bg-bg/30 px-3 py-2.5">
        <span className="data text-sm text-secondary">
          {clipCount} clip{clipCount === 1 ? "" : "s"} × {count} hook
          {count === 1 ? "" : "s"} ={" "}
          <span style={{ color: "var(--accent)" }}>
            {total} video{total === 1 ? "" : "s"}
          </span>
        </span>
        {!locked && (
          <button
            onClick={confirm}
            disabled={submitting || count === 0 || clipCount === 0}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-[#141310] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? "Starting…" : "Generate"}
          </button>
        )}
      </div>

      {error ? (
        <p className="text-xs" style={{ color: "#d98b6a" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
