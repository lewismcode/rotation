import Link from "next/link";
import { batchesRepo } from "@rotation/db";
import { requireContext } from "@/lib/context";
import { NewBatchButton } from "@/components/NewBatchButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  uploading: "uploading",
  ready: "ready",
  processing: "processing",
  complete: "complete",
  failed: "failed",
};

export default async function BatchesPage() {
  const ctx = await requireContext();
  const batches = await batchesRepo.listBatches(ctx.label.id);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Batches
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Drop clips, pick hooks, download finished Reels.
          </p>
        </div>
        <NewBatchButton />
      </div>

      {batches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-panel px-6 py-16 text-center">
          <p className="text-secondary">No batches yet.</p>
          <p className="mt-1 text-sm text-faint">
            Start a new batch to overlay hooks onto your clips.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-panel">
          {batches.map((b) => (
            <li key={b.id}>
              <Link
                href={`/batches/${b.id}`}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-bg/40"
              >
                <div className="flex flex-col">
                  <span className="data text-sm text-primary">
                    {b.id.slice(0, 8)}
                  </span>
                  <span className="data text-xs text-faint">
                    {new Date(b.created_at).toLocaleString()}
                  </span>
                </div>
                <StatusPill status={b.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const isDone = status === "complete";
  const isFail = status === "failed";
  return (
    <span
      className="data rounded-full border px-2.5 py-1 text-xs"
      style={{
        color: isDone
          ? "var(--complete)"
          : isFail
            ? "#d98b6a"
            : "var(--text-secondary)",
        borderColor: isDone
          ? "var(--complete)"
          : "var(--border)",
      }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
