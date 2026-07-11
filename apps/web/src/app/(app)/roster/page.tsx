import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { statsRepo } from "@rotation/db";
import { requireContextOrRedirect } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function RosterPage() {
  const ctx = await requireContextOrRedirect();
  if (ctx.user.role !== "admin") redirect("/dashboard");

  // Clerk org members are the source of truth for the team; our stats attach by
  // clerk user id (members who haven't created anything yet still show, at zero).
  const client = await clerkClient();
  const memberships =
    await client.organizations.getOrganizationMembershipList({
      organizationId: ctx.label.clerk_org_id,
      limit: 100,
    });
  const stats = await statsRepo.getRoster(ctx.label.id);
  const byClerk = new Map(stats.map((s) => [s.clerkUserId, s]));

  const members = memberships.data
    .map((m) => {
      const p = m.publicUserData;
      const s = p?.userId ? byClerk.get(p.userId) : undefined;
      const name =
        [p?.firstName, p?.lastName].filter(Boolean).join(" ") ||
        p?.identifier ||
        "Member";
      return {
        key: p?.userId ?? m.id,
        name,
        email: p?.identifier ?? "",
        imageUrl: p?.imageUrl ?? "",
        role: m.role === "org:admin" ? "admin" : "artist",
        batches: s?.batches ?? 0,
        reels: s?.reels ?? 0,
        lastActive: s?.lastActive ?? null,
      };
    })
    .sort((a, b) => b.reels - a.reels);

  return (
    <div className="space-y-6">
      <div className="rise">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Roster
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Everyone on {ctx.label.display_name} and what they&apos;ve made.
        </p>
      </div>

      <ul className="rise grid gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <li key={m.key} className="glass flex items-center gap-4 rounded-2xl p-4">
            {m.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.imageUrl}
                alt=""
                className="h-11 w-11 rounded-full object-cover ring-1 ring-[var(--glass-border)]"
              />
            ) : (
              <span
                className="grid h-11 w-11 place-items-center rounded-full text-sm font-medium"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {m.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-primary">
                  {m.name}
                </span>
                <span
                  className="data rounded-full px-1.5 py-0.5 text-[10px]"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                  }}
                >
                  {m.role}
                </span>
              </div>
              <div className="data mt-1 flex gap-3 text-xs text-secondary">
                <span>
                  <span className="text-primary">{m.reels}</span> reels
                </span>
                <span>
                  <span className="text-primary">{m.batches}</span> batches
                </span>
              </div>
            </div>
            <span className="data shrink-0 text-right text-[11px] text-faint">
              {m.lastActive
                ? new Date(m.lastActive).toLocaleDateString()
                : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
