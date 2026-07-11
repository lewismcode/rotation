import { redirect } from "next/navigation";
import { OrganizationProfile } from "@clerk/nextjs";
import { requireContextOrRedirect } from "@/lib/context";

export const dynamic = "force-dynamic";

/**
 * Admin-only team management. Labels are Clerk organizations, so member
 * management (invite by email, pending invites, roles, remove) is Clerk's
 * built-in <OrganizationProfile/> rather than something we reimplement — this
 * keeps it in-app instead of bouncing admins to the Clerk dashboard.
 *
 * hash routing so it lives on a single /team page (no catch-all segment).
 */
export default async function TeamPage() {
  const ctx = await requireContextOrRedirect();
  if (ctx.user.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="rise">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Team
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Invite artists to {ctx.label.display_name}, set who&apos;s an admin,
          and manage members. Invitees get an email to join.
        </p>
      </div>

      <div className="rise">
        <OrganizationProfile
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full max-w-none shadow-none",
            },
            variables: { colorPrimary: "#d4a13a" },
          }}
        />
      </div>
    </div>
  );
}
