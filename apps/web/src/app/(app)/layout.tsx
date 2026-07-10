import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton, OrganizationList } from "@clerk/nextjs";
import { getContext } from "@/lib/context";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The authenticated shell. Header reads the current label's display name (never
 * hardcoded — supports per-label branding), plus a persistent, unobtrusive
 * theme toggle top-right. No sidebar; the app is a linear, guided flow.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const ctx = await getContext();
  // Signed in but no active label (organization) yet — every label IS a Clerk
  // org, so send them to create/select one rather than looping to sign-in.
  if (!ctx) return <OrgGate />;

  const isAdmin = ctx.user.role === "admin";

  return (
    <div className="min-h-screen bg-bg text-primary">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <div className="flex items-center gap-6">
            <Link href="/batches" className="flex items-center gap-2.5">
              {ctx.label.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ctx.label.logo_url}
                  alt=""
                  className="h-6 w-6 rounded object-cover"
                />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              )}
              <span className="font-display text-[15px] font-medium tracking-tight">
                {ctx.label.display_name}
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-secondary">
              <Link href="/batches" className="hover:text-primary">
                Batches
              </Link>
              {isAdmin && (
                <Link href="/hooks" className="hover:text-primary">
                  Hooks
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserButton
              appearance={{ elements: { avatarBox: "h-7 w-7" } }}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
    </div>
  );
}

/**
 * Shown when a signed-in user has no active label yet. Labels are Clerk orgs, so
 * we surface Clerk's org create/select UI. Creating or picking one sets the
 * active org; the label row auto-provisions on the next request.
 */
function OrgGate() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="text-center">
          <div className="mb-3 flex items-center justify-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="font-display text-lg font-medium tracking-tight text-primary">
              Rotation
            </span>
          </div>
          <p className="text-sm text-secondary">
            Choose your label to continue, or create one to get started.
          </p>
        </div>
        <OrganizationList
          hidePersonal
          afterCreateOrganizationUrl="/batches"
          afterSelectOrganizationUrl="/batches"
        />
      </div>
    </div>
  );
}
