"use client";

import { useState } from "react";
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
  async function download() {
    setLoading(true);
    try {
      const res = await fetch(`/api/renders/${renderId}/download`);
      if (!res.ok) throw new Error("Could not get link");
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      onClick={download}
      disabled={loading}
      className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-primary hover:border-accent disabled:opacity-50"
    >
      {loading ? "…" : "Download"}
    </button>
  );
}

/**
 * One button: "Download all". Builds the zip (server-side), waits, then triggers
 * the download. No separate zip/ready states to clutter the UI.
 */
function ZipButton({ batchId }: { batchId: string }) {
  const [busy, setBusy] = useState(false);

  async function downloadAll() {
    setBusy(true);
    try {
      const post = await fetch(`/api/batches/${batchId}/zip`, { method: "POST" });
      if (!post.ok) {
        const { error } = await post.json().catch(() => ({}));
        throw new Error(error || "Could not prepare download");
      }
      // Poll until ready (202 while building, 200 { ready, url } when done).
      const started = Date.now();
      while (Date.now() - started < 5 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 2500));
        const res = await fetch(`/api/batches/${batchId}/zip`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.ready && data.url) {
            window.location.href = data.url;
            return;
          }
        }
      }
      throw new Error("Preparing the download timed out — try again");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={downloadAll}
      disabled={busy}
      className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-[#141310] shadow-lg shadow-[var(--accent-soft)] transition-opacity hover:opacity-90 disabled:opacity-70"
    >
      {busy ? "Preparing…" : "Download all"}
    </button>
  );
}
