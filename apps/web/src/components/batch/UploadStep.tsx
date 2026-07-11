"use client";

import { useRef, useState } from "react";
import type { Clip } from "@rotation/shared/types";

interface LocalUpload {
  name: string;
  status: "uploading" | "error";
  error?: string;
}

/**
 * Drag-and-drop (or pick) clips; each uploads directly to R2 via a presigned
 * PUT — video bytes never touch our Node server. After each upload we ask the
 * backend to probe the file, and the parent re-fetches to surface per-clip
 * resize warnings before any processing happens.
 */
export function UploadStep({
  batchId,
  clips,
  locked,
  onChanged,
  onContinue,
  canContinue,
}: {
  batchId: string;
  clips: Clip[];
  locked: boolean;
  onChanged: () => Promise<void> | void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const [local, setLocal] = useState<LocalUpload[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File) {
    setLocal((l) => [...l, { name: file.name, status: "uploading" }]);
    try {
      const presign = await fetch(`/api/batches/${batchId}/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "video/mp4",
          size: file.size,
        }),
      });
      if (!presign.ok) {
        const { error } = await presign.json().catch(() => ({}));
        throw new Error(error || "Upload could not be started");
      }
      const { clip, uploadUrl } = await presign.json();

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "video/mp4" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to storage failed");

      // Kick off the async probe. If this fails (e.g. the job queue / Redis is
      // unavailable), surface it — otherwise the clip would silently hang on
      // "uploading" with no way to tell why.
      const started = await fetch(`/api/clips/${clip.id}/uploaded`, {
        method: "POST",
      });
      if (!started.ok) {
        const { error } = await started.json().catch(() => ({}));
        throw new Error(
          error || "Uploaded to storage, but couldn't start processing"
        );
      }
      // Row now exists server-side; drop the local placeholder and refresh.
      setLocal((l) => l.filter((u) => u.name !== file.name));
      await onChanged();
    } catch (err) {
      setLocal((l) =>
        l.map((u) =>
          u.name === file.name
            ? { ...u, status: "error", error: (err as Error).message }
            : u
        )
      );
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const videos = Array.from(files).filter(
      (f) => f.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(f.name)
    );
    // Sequential to keep presign/probe ordering simple and avoid bursts.
    for (const f of videos) await uploadOne(f);
  }

  return (
    <div className="space-y-4">
      {!locked && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className="grid place-items-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors"
          style={{
            borderColor: dragging ? "var(--accent)" : "var(--border)",
            background: dragging ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
          }}
        >
          <p className="text-sm text-secondary">
            Drag a folder of clips here, or
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-primary hover:border-accent"
            >
              Choose files
            </button>
            <button
              onClick={() => folderRef.current?.click()}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-primary hover:border-accent"
            >
              Choose folder
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            multiple
            hidden
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <input
            ref={folderRef}
            type="file"
            hidden
            multiple
            // @ts-expect-error non-standard but widely supported
            webkitdirectory=""
            directory=""
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>
      )}

      <ul className="space-y-2">
        {clips.map((clip) => (
          <ClipRow key={clip.id} clip={clip} />
        ))}
        {local.map((u) => (
          <li
            key={u.name}
            className="flex items-center justify-between rounded-md border border-border bg-bg/30 px-3 py-2"
          >
            <span className="data truncate text-sm text-primary">{u.name}</span>
            <span className="data text-xs" style={{ color: u.status === "error" ? "#d98b6a" : "var(--text-secondary)" }}>
              {u.status === "error" ? u.error ?? "failed" : "uploading…"}
            </span>
          </li>
        ))}
      </ul>

      {!locked && (
        <div className="flex justify-end">
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-[#141310] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Continue to hooks
          </button>
        </div>
      )}
    </div>
  );
}

function ClipRow({ clip }: { clip: Clip }) {
  const status =
    clip.status === "ready"
      ? clip.needs_resize
        ? "will resize"
        : "ready"
      : clip.status;
  return (
    <li className="rounded-md border border-border bg-bg/30 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="data truncate text-sm text-primary">
          {clip.original_filename}
        </span>
        <span className="flex items-center gap-2">
          {clip.width && clip.height ? (
            <span className="data text-xs text-faint">
              {clip.width}×{clip.height}
            </span>
          ) : null}
          <StatusDot clip={clip} />
          <span className="data text-xs text-secondary">{status}</span>
        </span>
      </div>
      {clip.status === "ready" && clip.needs_resize ? (
        <p className="mt-2 text-xs" style={{ color: "var(--accent)" }}>
          This video will be resized/cropped to fit Reels format (9:16).
        </p>
      ) : null}
    </li>
  );
}

function StatusDot({ clip }: { clip: Clip }) {
  const color =
    clip.status === "ready"
      ? clip.needs_resize
        ? "var(--accent)"
        : "var(--complete)"
      : clip.status === "failed"
        ? "#d98b6a"
        : "var(--text-faint)";
  return <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />;
}
