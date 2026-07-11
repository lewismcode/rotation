"use client";

import { useRef, useState } from "react";
import type { Clip } from "@rotation/shared/types";
import { CropControl } from "./CropControl";

interface LocalUpload {
  id: string;
  name: string;
  status: "uploading" | "error";
  progress: number; // 0..1
  error?: string;
  file?: File; // kept on failure so the row can be retried
}

// How many clips upload to R2 at once. Direct-to-R2 PUTs are independent, so a
// handful in flight saturates the connection far better than one-at-a-time.
const UPLOAD_CONCURRENCY = 4;

// Recursively collect File objects from a dropped filesystem entry (a plain
// file, or a directory the browser exposes via the non-standard-but-ubiquitous
// webkitGetAsEntry API). Directory reads come back in batches, hence the loop.
async function readEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) =>
      (entry as FileSystemFileEntry).file(
        (f) => resolve([f]),
        () => resolve([])
      )
    );
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const out: File[] = [];
    const readBatch = (): Promise<void> =>
      new Promise((resolve) =>
        reader.readEntries(
          async (entries) => {
            if (!entries.length) return resolve();
            for (const e of entries) out.push(...(await readEntry(e)));
            resolve(readBatch());
          },
          () => resolve()
        )
      );
    await readBatch();
    return out;
  }
  return [];
}

// Turn a drop's DataTransfer into a flat File[] — traversing folders when the
// browser supports it, else falling back to the flat file list.
async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = dt.items;
  if (items?.length && typeof items[0]?.webkitGetAsEntry === "function") {
    // Extract entries synchronously — items are invalidated once we await.
    const entries = Array.from(items)
      .map((it) => it.webkitGetAsEntry())
      .filter((e): e is FileSystemEntry => e != null);
    const nested = await Promise.all(entries.map(readEntry));
    return nested.flat();
  }
  return Array.from(dt.files);
}

// PUT a file to a presigned URL via XHR so we get real upload progress (fetch
// can't report request-body progress). Resolves on 2xx, rejects otherwise.
function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("Upload to storage failed"));
    xhr.onerror = () => reject(new Error("Upload to storage failed"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(file);
  });
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
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File) {
    const id = crypto.randomUUID();
    setLocal((l) => [
      ...l,
      { id, name: file.name, status: "uploading", progress: 0 },
    ]);
    const setProgress = (progress: number) =>
      setLocal((l) => l.map((u) => (u.id === id ? { ...u, progress } : u)));
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

      await putWithProgress(uploadUrl, file, setProgress);

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
      // Row now exists server-side; drop the local placeholder.
      setLocal((l) => l.filter((u) => u.id !== id));
    } catch (err) {
      // Keep the File on the row so the user can retry without re-adding it.
      setLocal((l) =>
        l.map((u) =>
          u.id === id
            ? { ...u, status: "error", error: (err as Error).message, file }
            : u
        )
      );
    }
  }

  async function retryUpload(u: LocalUpload) {
    if (!u.file) return;
    setLocal((l) => l.filter((x) => x.id !== u.id));
    await uploadOne(u.file);
    await onChanged();
  }

  function dismissUpload(id: string) {
    setLocal((l) => l.filter((x) => x.id !== id));
  }

  async function handleFiles(input: File[]) {
    setNotice(null);
    const videos = input.filter(
      (f) => f.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(f.name)
    );
    const skipped = input.length - videos.length;
    if (skipped > 0) {
      setNotice(`Skipped ${skipped} non-video file${skipped === 1 ? "" : "s"}.`);
    }
    if (videos.length === 0) return;

    // Upload several at once (bounded) instead of one-at-a-time — this is the
    // big win for large batches. A shared queue feeds UPLOAD_CONCURRENCY
    // workers; we refetch the batch just once at the end rather than after
    // every file (polling then picks up probe → ready transitions).
    const queue = [...videos];
    const worker = async (): Promise<void> => {
      const next = queue.shift();
      if (!next) return;
      await uploadOne(next);
      await worker();
    };
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, videos.length) }, worker)
    );
    await onChanged();
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
            void filesFromDataTransfer(e.dataTransfer).then(handleFiles);
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
            onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
          />
          <input
            ref={folderRef}
            type="file"
            hidden
            multiple
            // @ts-expect-error non-standard but widely supported
            webkitdirectory=""
            directory=""
            onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
          />
        </div>
      )}

      {notice ? (
        <p className="text-xs text-secondary" role="status">
          {notice}
        </p>
      ) : null}

      <ul className="space-y-2">
        {clips.map((clip) => (
          <ClipRow
            key={clip.id}
            clip={clip}
            removable={!locked}
            editable={!locked}
            onRemove={async () => {
              await fetch(`/api/clips/${clip.id}`, { method: "DELETE" });
              await onChanged();
            }}
          />
        ))}
        {local.map((u) => (
          <li
            key={u.id}
            className="rounded-md border border-border bg-bg/30 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="data truncate text-sm text-primary">
                {u.name}
              </span>
              <span
                className="data shrink-0 text-xs"
                style={{
                  color:
                    u.status === "error" ? "#d98b6a" : "var(--text-secondary)",
                }}
              >
                {u.status === "error"
                  ? u.error ?? "failed"
                  : `${Math.round(u.progress * 100)}%`}
              </span>
            </div>
            {u.status !== "error" ? (
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--glass-border)]">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${Math.max(3, u.progress * 100)}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                {u.file ? (
                  <button
                    onClick={() => void retryUpload(u)}
                    className="rounded-md border border-border px-2.5 py-1 text-[11px] text-primary hover:border-accent"
                  >
                    Retry
                  </button>
                ) : null}
                <button
                  onClick={() => dismissUpload(u.id)}
                  className="rounded-md border border-[var(--glass-border)] px-2.5 py-1 text-[11px] text-secondary hover:text-primary"
                >
                  Dismiss
                </button>
              </div>
            )}
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

function ClipRow({
  clip,
  removable,
  editable,
  onRemove,
}: {
  clip: Clip;
  removable: boolean;
  editable: boolean;
  onRemove: () => void | Promise<void>;
}) {
  const [cropOpen, setCropOpen] = useState(false);
  const canCrop = editable && clip.status === "ready" && clip.needs_resize;
  const status =
    clip.status === "ready"
      ? clip.needs_resize
        ? "will resize"
        : "ready"
      : clip.status;
  return (
    <li className="rounded-md border border-[var(--glass-border)] bg-bg/30 px-3 py-2">
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
          {removable ? (
            <button
              onClick={() => void onRemove()}
              title="Remove clip"
              aria-label="Remove clip"
              className="-mr-1 grid h-8 w-8 place-items-center rounded-full text-secondary transition-colors hover:bg-[var(--glass-border)] hover:text-[#c0553a]"
            >
              ×
            </button>
          ) : null}
        </span>
      </div>
      {clip.status === "ready" && clip.needs_resize ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs" style={{ color: "var(--accent)" }}>
            This video will be cropped to fit Reels (9:16).
          </p>
          {canCrop ? (
            <button
              onClick={() => setCropOpen((o) => !o)}
              className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] text-primary hover:border-accent"
            >
              {cropOpen ? "Done" : "Adjust framing"}
            </button>
          ) : null}
        </div>
      ) : null}
      {canCrop && cropOpen ? <CropControl clip={clip} /> : null}
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
