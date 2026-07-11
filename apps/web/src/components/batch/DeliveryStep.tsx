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
    return (
      <p className="text-sm text-secondary">
        Finished videos will show up here as they complete.
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

      <ul className="space-y-2">
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
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg/30 px-3 py-2.5"
            >
              <div className="flex min-w-0 flex-col">
                <span className="data truncate text-sm text-primary">{name}</span>
                {hook ? (
                  <span className="truncate text-xs text-faint">{hook.text}</span>
                ) : null}
              </div>
              <DownloadButton renderId={r.id} />
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

function ZipButton({ batchId }: { batchId: string }) {
  const [state, setState] = useState<"idle" | "building" | "ready">("idle");
  const [url, setUrl] = useState<string | null>(null);

  async function buildZip() {
    setState("building");
    try {
      const post = await fetch(`/api/batches/${batchId}/zip`, { method: "POST" });
      if (!post.ok) {
        const { error } = await post.json().catch(() => ({}));
        throw new Error(error || "Could not start zip");
      }
      // Poll until the worker has uploaded the zip. The status endpoint returns
      // 202 (still ok!) with { ready: false } while building, and 200 with
      // { ready: true, url } once done — so gate on `ready`+`url`, never on
      // res.ok alone (a 202 with no url would navigate to /batches/undefined).
      const started = Date.now();
      while (Date.now() - started < 5 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 2500));
        const res = await fetch(`/api/batches/${batchId}/zip`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.ready && data.url) {
            setUrl(data.url);
            setState("ready");
            window.location.href = data.url;
            return;
          }
        }
      }
      throw new Error("Zip timed out");
    } catch (err) {
      setState("idle");
      alert((err as Error).message);
    }
  }

  if (state === "ready" && url) {
    return (
      <a
        href={url}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-[#141310] hover:opacity-90"
      >
        Download .zip
      </a>
    );
  }

  return (
    <button
      onClick={buildZip}
      disabled={state === "building"}
      className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-[#141310] transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {state === "building" ? "Zipping…" : "Download all (.zip)"}
    </button>
  );
}
