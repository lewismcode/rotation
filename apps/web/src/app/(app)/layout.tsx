import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { requireContextOrRedirect } from "@/lib/context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLinks } from "@/components/NavLinks";

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
    <div className="min-h-screen text-primary">
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="glass-strong mx-auto flex h-14 max-w-5xl items-center justify-between rounded-2xl px-4">
          <div className="flex items-center gap-2 sm:gap-5">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              {ctx.label.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ctx.label.logo_url}
                  alt=""
                  className="h-7 w-7 rounded-lg object-cover ring-1 ring-[var(--glass-border)]"
                />
              ) : (
                <span
                  className="grid h-7 w-7 place-items-center rounded-lg text-[13px]"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #52a89b))",
                    color: "#141310",
                  }}
                >
                  ●
                </span>
              )}
              <span className="hidden font-display text-[15px] font-medium tracking-tight sm:block">
                {ctx.label.display_name}
              </span>
            </Link>
            <NavLinks isAdmin={isAdmin} />
          </div>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-3 py-6 sm:px-5 sm:py-8">
        {children}
      </main>
    </div>
  );
}
