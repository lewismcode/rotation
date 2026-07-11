"use client";

/**
 * Renders a timestamp using the viewer's locale/timezone. Because that differs
 * from the server's, we suppress the hydration warning (the client value is the
 * correct one) — this avoids React #418 hydration-mismatch errors from dates.
 */
export function Time({
  value,
  mode = "datetime",
}: {
  value: string;
  mode?: "datetime" | "date";
}) {
  const d = new Date(value);
  const text =
    mode === "date" ? d.toLocaleDateString() : d.toLocaleString();
  return <span suppressHydrationWarning>{text}</span>;
}
