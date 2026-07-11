const LABEL: Record<string, string> = {
  uploading: "uploading",
  ready: "ready",
  processing: "processing",
  complete: "complete",
  failed: "failed",
};

/** Small status chip; color encodes state (teal done, warm-red failed). */
export function StatusPill({ status }: { status: string }) {
  const done = status === "complete";
  const fail = status === "failed";
  const color = done
    ? "var(--complete)"
    : fail
      ? "#d98b6a"
      : "var(--text-secondary)";
  return (
    <span
      className="data rounded-full border px-2.5 py-1 text-xs"
      style={{
        color,
        borderColor: done
          ? "var(--complete)"
          : fail
            ? "#d98b6a"
            : "var(--glass-border)",
        background: done || fail ? "transparent" : "var(--accent-soft)",
      }}
    >
      {LABEL[status] ?? status}
    </span>
  );
}
