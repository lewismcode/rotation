import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { requireContextOrRedirect } from "@/lib/context";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The authenticated shell. Header reads the current label's display name (never
 * hardcoded — supports per-label branding), plus a persistent, unobtrusive
 * theme toggle top-right. No sidebar; the app is a linear, guided flow.
 *
 * Guarding here isn't enough on its own — layout and page render concurrently —
 * so each page also calls requireContextOrRedirect(). Both redirect a user with
 * no active label to /select-label rather than throwing.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireContextOrRedirect();
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
