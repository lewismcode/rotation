import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { statsRepo, usersRepo, batchesRepo } from "@rotation/db";
import { batchDisplayName } from "@rotation/shared";
import { requireContextOrRedirect } from "@/lib/context";
import { Stat } from "@/components/dashboard/Stat";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { StyleBreakdown } from "@/components/dashboard/StyleBreakdown";
import { StatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const ctx = await requireContextOrRedirect();
  if (ctx.user.role !== "admin") redirect("/dashboard");
  const { userId } = await params;

  const user = await usersRepo.getUserInLabel(ctx.label.id, userId);
  if (!user) notFound();

  const client = await clerkClient();
  const profile = await client.users.getUser(user.clerk_user_id).catch(() => null);
  const name =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    profile?.emailAddresses?.[0]?.emailAddress ||
    "Artist";

  const [stats, activity, styles, batches] = await Promise.all([
    statsRepo.getDashboard(ctx.label.id, user.id),
    statsRepo.getActivity(ctx.label.id, 14, user.id),
    statsRepo.getStyleBreakdown(ctx.label.id, user.id),
    batchesRepo.listBatches(ctx.label.id, { createdByUserId: user.id }),
  ]);

  return (
    <div className="space-y-6">
      <div className="rise">
        <Link href="/roster" className="text-sm text-secondary hover:text-primary">
          ← Roster
        </Link>
        <div className="mt-3 flex items-center gap-4">
          {profile?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.imageUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover ring-1 ring-[var(--glass-border)]"
            />
          ) : (
            <span
              className="grid h-14 w-14 place-items-center rounded-full text-lg font-medium"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {name}
            </h1>
            <p className="data mt-0.5 text-xs text-faint">
              {user.role} · joined {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="rise grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Reels generated" value={stats.reelsGenerated} accent />
        <Stat label="In progress" value={stats.rendersInProgress} />
        <Stat label="Batches" value={stats.batches} />
        <Stat label="Clips uploaded" value={stats.clips} />
      </div>

      <div className="rise grid gap-4 lg:grid-cols-2">
        <ActivityChart data={activity} />
        <StyleBreakdown data={styles} />
      </div>

      <section className="glass rise rounded-2xl p-5">
        <h2 className="mb-3 font-display text-lg font-medium tracking-tight">
          Batches
        </h2>
        {batches.length === 0 ? (
          <p className="py-6 text-center text-sm text-faint">
            {name} hasn&apos;t created any batches yet.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {batches.map((b) => (
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
                      {new Date(b.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <StatusPill status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
