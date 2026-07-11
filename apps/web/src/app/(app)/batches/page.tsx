import Link from "next/link";
import { batchesRepo } from "@rotation/db";
import { requireContextOrRedirect } from "@/lib/context";
import { NewBatchButton } from "@/components/NewBatchButton";
import { StatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const ctx = await requireContextOrRedirect();
  const batches = await batchesRepo.listBatches(ctx.label.id);

  return (
    <div className="space-y-6">
      <div className="rise flex items-end justify-between">
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
        <div className="glass rise grid place-items-center rounded-2xl px-6 py-16 text-center">
          <p className="text-secondary">No batches yet.</p>
          <p className="mt-1 text-sm text-faint">
            Start a new batch to overlay hooks onto your clips.
          </p>
        </div>
      ) : (
        <ul className="rise grid gap-3 sm:grid-cols-2">
          {batches.map((b) => (
            <li key={b.id}>
              <Link
                href={`/batches/${b.id}`}
                className="glass glass-hover flex items-center justify-between rounded-2xl px-5 py-4"
              >
                <div className="flex flex-col">
                  <span className="data text-sm text-primary">
                    batch {b.id.slice(0, 8)}
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
