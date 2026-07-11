import { CAPTION_STYLES } from "@rotation/shared/caption-styles";

const LABELS = new Map<string, string>(
  CAPTION_STYLES.map((s) => [s.id, s.label])
);

/** Horizontal usage bars per caption style — which looks the label reaches for. */
export function StyleBreakdown({
  data,
}: {
  data: Array<{ style: string; count: number }>;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="mb-4 font-display text-lg font-medium tracking-tight">
        Caption styles used
      </h2>
      {data.length === 0 ? (
        <p className="py-4 text-center text-sm text-faint">
          Style usage shows up once you generate reels.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {data.map((d) => (
            <li key={d.style} className="flex items-center gap-3">
              <span className="w-20 shrink-0 truncate text-xs text-secondary">
                {LABELS.get(d.style) ?? d.style}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--glass-border)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, (d.count / max) * 100)}%`,
                    background:
                      "linear-gradient(90deg, color-mix(in srgb, var(--accent) 55%, transparent), var(--accent))",
                  }}
                />
              </div>
              <span className="data w-8 shrink-0 text-right text-xs text-faint">
                {d.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
