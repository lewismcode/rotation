"use client";

import { useEffect, useRef, useState } from "react";
import type { Clip, Hook, Render } from "@rotation/shared/types";
import { outputFilename } from "@rotation/shared/slug";

/**
 * Delivery: a grid of finished outputs, each with its own Download, plus a
 * batch-level Download All (.zip). Individual links are presigned R2 GETs;
 * the zip is built server-side by the worker and polled for readiness.
 */
export function DeliveryStep({
  batchId,
  clips,
  hooks,
  renders,
}: {
  batchId: string;
  clips: Clip[];
  hooks: Hook[];
  renders: Render[];
}) {
  const complete = renders.filter((r) => r.status === "complete");
  const clipById = new Map(clips.map((c) => [c.id, c]));
  const hookById = new Map(hooks.map((h) => [h.id, h]));

  if (complete.length === 0) {
    const anyFailed = renders.some((r) => r.status === "failed");
    return (
      <p className="text-sm text-secondary">
        {anyFailed
          ? "No finished videos yet — open the Render step above to see what failed and retry."
          : "Finished videos will show up here as they complete."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="data text-sm text-secondary">
          {complete.length} ready
        </span>
        <ZipButton batchId={batchId} />
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {complete.map((r) => {
          const clip = clipById.get(r.clip_id);
          const hook = hookById.get(r.hook_id);
          const name =
            clip && hook
              ? outputFilename(clip.original_filename, hook.text)
              : `render-${r.id}.mp4`;
          return (
            <li
              key={r.id}
              className="glass flex flex-col overflow-hidden rounded-xl"
            >
              <div
                className="relative aspect-[9/16] w-full overflow-hidden"
                style={{ background: "#0d0c0a" }}
              >
                {r.thumbnail_r2_key ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/renders/${r.id}/thumbnail`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs text-faint">
                    preview soon
                  </div>
                )}
                {hook ? (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[11px] text-white/90">
                    {hook.text}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="data truncate text-[11px] text-secondary" title={name}>
                  {name}
                </span>
                <DownloadButton renderId={r.id} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DownloadButton({ renderId }: { renderId: string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function download() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/renders/${renderId}/download`);
      if (!res.ok) throw new Error("Could not get link");
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      onClick={download}
      disabled={loading}
      title={err ?? undefined}
      className={`shrink-0 rounded-md border px-3 py-1.5 text-xs disabled:opacity-50 ${
        err
          ? "border-[#c0553a] text-[#c0553a]"
          : "border-border text-primary hover:border-accent"
      }`}
    >
      {loading ? "…" : err ? "Retry" : "Download"}
    </button>
  );
}

/**
 * "Download all": builds the zip server-side, polls until ready, then triggers
 * the download. Shows elapsed time while building and surfaces errors inline.
 * The poll is tied to the component's lifetime — if the step is collapsed (this
 * unmounts), the loop stops and won't yank the user to a download later.
 */
function ZipButton({ batchId }: { batchId: string }) {
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const cancelled = useRef(false);
  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  async function downloadAll() {
    setBusy(true);
    setErr(null);
    setElapsed(0);
    const started = Date.now();
    const tick = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000
    );
    try {
      const post = await fetch(`/api/batches/${batchId}/zip`, { method: "POST" });
      if (!post.ok) {
        const { error } = await post.json().catch(() => ({}));
        throw new Error(error || "Could not prepare download");
      }
      // Poll until ready (202 while building, 200 { ready, url } when done).
      while (Date.now() - started < 5 * 60 * 1000) {
        if (cancelled.current) return;
        await new Promise((r) => setTimeout(r, 2500));
        if (cancelled.current) return;
        const res = await fetch(`/api/batches/${batchId}/zip`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.ready && data.url) {
            if (cancelled.current) return;
            window.location.href = data.url;
            return;
          }
        }
      }
      throw new Error("Preparing the download timed out — try again");
    } catch (e) {
      if (!cancelled.current) setErr((e as Error).message);
    } finally {
      clearInterval(tick);
      if (!cancelled.current) setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={downloadAll}
        disabled={busy}
        className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-[#141310] shadow-lg shadow-[var(--accent-soft)] transition-opacity hover:opacity-90 disabled:opacity-70"
      >
        {busy ? `Preparing… ${elapsed}s` : "Download all"}
      </button>
      {err ? (
        <span className="text-xs" style={{ color: "#c0553a" }}>
          {err}
        </span>
      ) : null}
    </div>
  );
}
