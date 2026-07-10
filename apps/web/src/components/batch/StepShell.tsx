"use client";

import type { ReactNode } from "react";

export type StepState = "complete" | "active" | "locked";

/**
 * One node in the vertical "signal chain". Progress is legible from state alone
 * — active is expanded with an amber border, complete collapses to a thin
 * tappable strip, locked is dim and inert. No separate progress bar.
 */
export function StepShell({
  index,
  title,
  state,
  expanded,
  summary,
  onToggle,
  children,
}: {
  index: number;
  title: string;
  state: StepState;
  expanded: boolean;
  summary?: ReactNode;
  onToggle?: () => void;
  children?: ReactNode;
}) {
  const locked = state === "locked";
  const clickable = !locked && !!onToggle;

  const borderColor =
    state === "active"
      ? "var(--accent)"
      : "var(--border)";

  return (
    <div
      className="rounded-lg border bg-panel transition-colors"
      style={{
        borderColor,
        opacity: locked ? 0.5 : 1,
      }}
    >
      <button
        type="button"
        onClick={clickable ? onToggle : undefined}
        disabled={!clickable}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        style={{ cursor: clickable ? "pointer" : "default" }}
      >
        <StepMarker index={index} state={state} />
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <span
            className="font-display text-[15px] font-medium tracking-tight"
            style={{ color: locked ? "var(--text-faint)" : "var(--text-primary)" }}
          >
            {title}
          </span>
          {!expanded && summary ? (
            <span className="data truncate text-xs text-secondary">{summary}</span>
          ) : null}
        </div>
      </button>
      {expanded && !locked ? (
        <div className="border-t border-border px-4 py-4">{children}</div>
      ) : null}
    </div>
  );
}

function StepMarker({ index, state }: { index: number; state: StepState }) {
  const isComplete = state === "complete";
  return (
    <span
      className="data grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs"
      style={{
        borderColor: isComplete
          ? "var(--complete)"
          : state === "active"
            ? "var(--accent)"
            : "var(--border)",
        color: isComplete
          ? "var(--complete)"
          : state === "active"
            ? "var(--accent)"
            : "var(--text-faint)",
      }}
    >
      {isComplete ? "✓" : index}
    </span>
  );
}
