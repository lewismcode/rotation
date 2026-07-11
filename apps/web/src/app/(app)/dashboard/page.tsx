import Link from "next/link";
import { statsRepo } from "@rotation/db";
import { batchDisplayName } from "@rotation/shared";
import { requireContextOrRedirect } from "@/lib/context";
import { scopedUserId } from "@/lib/scope";
import { NewBatchButton } from "@/components/NewBatchButton";
import { StatusPill } from "@/components/StatusPill";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { StyleBreakdown } from "@/components/dashboard/StyleBreakdown";
import { Stat } from "@/components/dashboard/Stat";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireContextOrRedirect();
  const uid = scopedUserId(ctx); // undefined for admin (whole label), else self
  const [stats, activity, styles] = await Promise.all([
    statsRepo.getDashboard(ctx.label.id, uid),
    statsRepo.getActivity(ctx.label.id, 14, uid),
    statsRepo.getStyleBreakdown(ctx.label.id, uid),
  ]);
  const firstName = ctx.label.display_name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="data text-xs uppercase tracking-widest text-faint">
            {ctx.user.role === "admin" ? "Label" : "Artist"} · Overview
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            {firstName}
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Drop clips, pick hooks, download ready-to-post Reels.
          </p>
        </div>
        <NewBatchButton />
      </div>

      {/* Stat tiles */}
      <div className="rise grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Reels generated" value={stats.reelsGenerated} accent />
        <Stat label="In progress" value={stats.rendersInProgress} />
        <Stat label="Batches" value={stats.batches} />
        <Stat label="Active hooks" value={stats.activeHooks} />
      </div>

      {/* Analytics */}
      <div className="rise grid gap-4 lg:grid-cols-2">
        <ActivityChart data={activity} />
        <StyleBreakdown data={styles} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent batches */}
        <section className="glass rise rounded-2xl p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-medium tracking-tight">
              Recent batches
            </h2>
            <Link
              href="/batches"
              className="text-sm text-secondary hover:text-primary"
            >
              View all →
            </Link>
          </div>
          {stats.recentBatches.length === 0 ? (
            <EmptyHint>
              No batches yet — start one to overlay hooks onto your clips.
            </EmptyHint>
          ) : (
            <ul className="space-y-2">
              {stats.recentBatches.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/batches/${b.id}`}
                    className="glass-hover flex items-center justify-between rounded-xl border border-[var(--glass-border)] px-4 py-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-primary">
                        {batchDisplayName(b)}
                      </span>
                      <span className="data text-xs text-faint">
                        {b.clip_count} clip{b.clip_count === 1 ? "" : "s"}
                        {b.render_total > 0
                          ? ` · ${b.render_complete}/${b.render_total} reels`
                          : ""}{" "}
                        · {new Date(b.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <StatusPill status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top hooks */}
        <section className="glass rise rounded-2xl p-5">
          <h2 className="mb-3 font-display text-lg font-medium tracking-tight">
            Top hooks
          </h2>
          {stats.topHooks.length === 0 ? (
            <EmptyHint>Your most-used hooks will show up here.</EmptyHint>
          ) : (
            <ul className="space-y-3">
              {stats.topHooks.map((h, i) => (
                <li key={h.id} className="flex items-start gap-3">
                  <span
                    className="data mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px]"
                    style={{
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-primary">{h.text}</span>
                  <span className="data shrink-0 text-xs text-faint">
                    ×{h.uses}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-faint">{children}</p>;
}
