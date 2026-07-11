import { batchesRepo } from "@rotation/db";
import { batchDisplayName } from "@rotation/shared";
import { requireContextOrRedirect } from "@/lib/context";
import { creatorScope } from "@/lib/scope";
import { NewBatchButton } from "@/components/NewBatchButton";
import { BatchCard } from "@/components/BatchCard";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const ctx = await requireContextOrRedirect();
  const isAdmin = ctx.user.role === "admin";
  const batches = await batchesRepo.listBatches(ctx.label.id, creatorScope(ctx));

  return (
    <div className="space-y-6">
      <div className="rise flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Batches
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {isAdmin
              ? "Every batch across your label."
              : "Your batches — drop clips, pick hooks, download finished Reels."}
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
              <BatchCard
                id={b.id}
                title={batchDisplayName(b)}
                createdAt={b.created_at}
                status={b.status}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
