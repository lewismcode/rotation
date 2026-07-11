"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/batches", label: "Batches" },
  { href: "/roster", label: "Roster", adminOnly: true },
  { href: "/hooks", label: "Hooks", adminOnly: true },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {LINKS.filter((l) => !l.adminOnly || isAdmin).map((l) => {
        const active =
          pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full px-3 py-1.5 text-sm transition-colors"
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
