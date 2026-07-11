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

  return (
    <div
      className="glass overflow-hidden rounded-2xl transition-all"
      style={{
        opacity: locked ? 0.55 : 1,
        boxShadow:
          state === "active"
            ? "var(--glass-shadow), inset 0 1px 0 0 var(--glass-highlight), 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)"
            : undefined,
        borderColor: state === "active" ? "transparent" : undefined,
      }}
    >
      <button
        type="button"
        onClick={clickable ? onToggle : undefined}
        disabled={!clickable}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
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
        <div className="border-t border-[var(--glass-border)] px-4 py-4">
          {children}
        </div>
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
