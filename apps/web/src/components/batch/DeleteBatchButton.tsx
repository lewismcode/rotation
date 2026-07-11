"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Archive (soft-delete) the batch. Files are retained for the retention window,
 * so this is recoverable — but it disappears from the UI immediately.
 */
export function DeleteBatchButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/batches/${batchId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete batch");
      router.push("/batches");
      router.refresh();
    } catch (e) {
      setBusy(false);
      setErr((e as Error).message);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="text-xs"
          style={{ color: err ? "#c0553a" : "var(--text-secondary)" }}
        >
          {err ?? "Delete this batch?"}
        </span>
        <button
          onClick={del}
          disabled={busy}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          style={{ background: "#c0553a" }}
        >
          {busy ? "…" : "Delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-full border border-[var(--glass-border)] px-3 py-1.5 text-xs text-secondary hover:text-primary"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="grid h-8 w-8 place-items-center rounded-full border border-[var(--glass-border)] text-secondary transition-colors hover:border-[#c0553a] hover:text-[#c0553a]"
      title="Delete batch"
      aria-label="Delete batch"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      </svg>
    </button>
  );
}
