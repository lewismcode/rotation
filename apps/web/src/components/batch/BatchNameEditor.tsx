"use client";

import { useState } from "react";
import { batchDisplayName } from "@rotation/shared/types";

/**
 * Editable batch title. Shows the friendly name ("Batch 12" or a custom label)
 * and lets the owner rename it inline — no raw UUIDs in the UI.
 */
export function BatchNameEditor({
  batchId,
  name,
  labelSeq,
}: {
  batchId: string;
  name: string | null;
  labelSeq: number | null;
}) {
  const [display, setDisplay] = useState(
    batchDisplayName({ id: batchId, name, label_seq: labelSeq })
  );
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value.trim() || null }),
      });
      if (res.ok) {
        const { batch } = await res.json();
        setDisplay(batchDisplayName(batch));
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") setEditing(false);
          }}
          maxLength={80}
          placeholder={display}
          className="w-full max-w-xs rounded-lg border border-[var(--glass-border)] bg-[var(--bg)]/40 px-3 py-1.5 font-display text-2xl font-semibold tracking-tight text-primary outline-none focus:border-accent"
        />
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-[#141310] disabled:opacity-60"
        >
          {saving ? "…" : "Save"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setValue(name ?? "");
        setEditing(true);
      }}
      className="group inline-flex items-center gap-2"
      title="Rename batch"
    >
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {display}
      </h1>
      <span className="text-secondary opacity-0 transition-opacity group-hover:opacity-100">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </span>
    </button>
  );
}
