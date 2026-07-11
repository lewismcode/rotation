/** A single glass stat tile: big number + label, optional accent emphasis. */
export function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div
        className="data text-3xl font-semibold tabular-nums"
        style={{ color: accent ? "var(--accent)" : "var(--text-primary)" }}
      >
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-xs text-secondary">{label}</div>
    </div>
  );
}
