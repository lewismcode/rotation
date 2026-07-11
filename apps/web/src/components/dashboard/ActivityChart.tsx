/**
 * Reels-per-day over the trailing window. Deliberately minimal: one accent hue,
 * a faint baseline, tabular numerals, and an emphasized final (today) bar.
 */
export function ActivityChart({
  data,
}: {
  data: Array<{ day: string; count: number }>;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-medium tracking-tight">
          Reels generated
        </h2>
        <span className="data text-xs text-faint">
          <span className="text-primary">{total}</span> · last {data.length} days
        </span>
      </div>

      <div
        className="flex h-28 items-end gap-1"
        style={{
          borderBottom: "1px solid var(--glass-border)",
        }}
        role="img"
        aria-label={`Reels generated per day: ${data
          .map((d) => `${d.day}: ${d.count}`)
          .join(", ")}`}
      >
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          const h = Math.round((d.count / max) * 100);
          return (
            <div
              key={d.day}
              className="group relative flex-1"
              style={{ height: "100%" }}
            >
              <div
                className="absolute bottom-0 w-full rounded-t-[3px] transition-all"
                style={{
                  height: `${Math.max(d.count > 0 ? 6 : 2, h)}%`,
                  background: isLast
                    ? "var(--accent)"
                    : "color-mix(in srgb, var(--accent) 42%, transparent)",
                }}
                title={`${d.day}: ${d.count}`}
              />
            </div>
          );
        })}
      </div>
      <div className="data mt-1.5 flex justify-between text-[10px] text-faint">
        <span>{fmt(data[0]?.day)}</span>
        <span>today</span>
      </div>
    </section>
  );
}

function fmt(day?: string): string {
  if (!day) return "";
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
