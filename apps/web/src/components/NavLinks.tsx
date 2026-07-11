"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/batches", label: "Batches" },
  { href: "/roster", label: "Roster", adminOnly: true },
  { href: "/team", label: "Team", adminOnly: true },
  { href: "/hooks", label: "Hooks", adminOnly: true },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    // Scroll the tabs within the header on narrow screens instead of letting
    // them widen the page. min-w-0 lets this flex child shrink below its
    // content; the scrollbar is hidden for a clean toolbar.
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {LINKS.filter((l) => !l.adminOnly || isAdmin).map((l) => {
        const active =
          pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors"
            style={{
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              background: active ? "var(--accent-soft)" : "transparent",
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
