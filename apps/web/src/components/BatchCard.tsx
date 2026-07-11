"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusPill } from "./StatusPill";
import { Time } from "./Time";

/**
 * Batches-list card. Clicking the body opens the batch; a hover trash button
 * archives it (soft-delete) without opening — for quick cleanup while testing.
 */
export function BatchCard({
  id,
  title,
  createdAt,
  status,
}: {
  id: string;
  title: string;
  createdAt: string;
  status: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);

  async function del() {
    setBusy(true);
    try {
      const res = await fetch(`/api/batches/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
      setGone(true);
      router.refresh();
    } catch (err) {
      setBusy(false);
      alert((err as Error).message);
    }
  }

  if (gone) return null;

  return (
    <div
      onClick={() => router.push(`/batches/${id}`)}
      className="glass glass-hover group flex cursor-pointer items-center justify-between rounded-2xl px-5 py-4"
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium text-primary">{title}</span>
        <span className="data text-xs text-faint">
          <Time value={createdAt} />
        </span>
      </div>
      <div className="flex items-center gap-2">
        {confirming ? (
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={del}
              disabled={busy}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
              style={{ background: "#c0553a" }}
            >
              {busy ? "…" : "Delete"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-full border border-[var(--glass-border)] px-2.5 py-1 text-xs text-secondary"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <StatusPill status={status} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(true);
              }}
              title="Delete batch"
              aria-label="Delete batch"
              className="grid h-7 w-7 place-items-center rounded-full text-faint opacity-0 transition-all hover:text-[#c0553a] group-hover:opacity-100"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
