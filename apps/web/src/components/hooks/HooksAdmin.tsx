"use client";

import { useState } from "react";
import type { Hook } from "@rotation/shared/types";

/**
 * Admin-only hook library: plain table + inline modal form. Add, edit text, and
 * toggle active/inactive. No categories/tags (out of scope for MVP).
 */
export function HooksAdmin({ initialHooks }: { initialHooks: Hook[] }) {
  const [hooks, setHooks] = useState<Hook[]>(initialHooks);
  const [editing, setEditing] = useState<Hook | "new" | null>(null);

  async function save(text: string, hook: Hook | "new") {
    if (hook === "new") {
      const res = await fetch("/api/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const { hook: created } = await res.json();
        setHooks((h) => [created, ...h]);
      }
    } else {
      const res = await fetch(`/api/hooks/${hook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const { hook: updated } = await res.json();
        setHooks((h) => h.map((x) => (x.id === updated.id ? updated : x)));
      }
    }
    setEditing(null);
  }

  async function toggleActive(hook: Hook) {
    const res = await fetch(`/api/hooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !hook.is_active }),
    });
    if (res.ok) {
      const { hook: updated } = await res.json();
      setHooks((h) => h.map((x) => (x.id === updated.id ? updated : x)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rise flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Hook library
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Proven-performing captions overlaid onto clips.
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="rounded-full bg-accent px-4 py-2 font-medium text-[#141310] shadow-lg shadow-[var(--accent-soft)] transition-opacity hover:opacity-90"
        >
          Add hook
        </button>
      </div>

      {hooks.length === 0 ? (
        <div className="glass rise grid place-items-center rounded-2xl px-6 py-16 text-center">
          <p className="text-secondary">No hooks yet.</p>
          <p className="mt-1 text-sm text-faint">
            Add a hook to overlay it onto clips.
          </p>
        </div>
      ) : (
        <ul className="rise grid gap-2.5 sm:grid-cols-2">
          {hooks.map((hook) => (
            <li
              key={hook.id}
              className="glass flex flex-col justify-between gap-3 rounded-2xl p-4"
            >
              <p className="text-sm text-primary">{hook.text}</p>
              <div className="flex items-center justify-between">
                <span
                  className="data inline-flex items-center gap-1.5 text-xs"
                  style={{
                    color: hook.is_active
                      ? "var(--complete)"
                      : "var(--text-faint)",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: hook.is_active
                        ? "var(--complete)"
                        : "var(--text-faint)",
                    }}
                  />
                  {hook.is_active ? "active" : "inactive"}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(hook)}
                    className="rounded-full border border-[var(--glass-border)] px-3 py-1 text-xs text-primary transition-colors hover:border-accent"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(hook)}
                    className="rounded-full border border-[var(--glass-border)] px-3 py-1 text-xs text-secondary transition-colors hover:border-accent hover:text-primary"
                  >
                    {hook.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== null ? (
        <HookModal
          hook={editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      ) : null}
    </div>
  );
}

function HookModal({
  hook,
  onClose,
  onSave,
}: {
  hook: Hook | "new";
  onClose: () => void;
  onSave: (text: string, hook: Hook | "new") => Promise<void>;
}) {
  const [text, setText] = useState(hook === "new" ? "" : hook.text);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setSaving(true);
    await onSave(text.trim(), hook);
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-medium">
          {hook === "new" ? "Add hook" : "Edit hook"}
        </h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={300}
          autoFocus
          placeholder="e.g. wait for the drop 🔊"
          className="mt-4 w-full resize-none rounded-xl border border-[var(--glass-border)] bg-[var(--bg)]/40 px-3 py-2 text-sm text-primary outline-none focus:border-accent"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-secondary hover:text-primary"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !text.trim()}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-[#141310] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
