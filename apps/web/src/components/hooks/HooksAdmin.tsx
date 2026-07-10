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
    <div className="space-y-8">
      <div className="flex items-end justify-between">
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
          className="rounded-md bg-accent px-4 py-2 font-medium text-[#141310] hover:opacity-90"
        >
          Add hook
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-faint">
              <th className="px-4 py-3 font-medium">Hook</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {hooks.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-secondary">
                  No hooks yet.
                </td>
              </tr>
            ) : (
              hooks.map((hook) => (
                <tr key={hook.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-primary">{hook.text}</td>
                  <td className="px-4 py-3">
                    <span
                      className="data text-xs"
                      style={{
                        color: hook.is_active
                          ? "var(--complete)"
                          : "var(--text-faint)",
                      }}
                    >
                      {hook.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditing(hook)}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-primary hover:border-accent"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(hook)}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-secondary hover:border-accent hover:text-primary"
                      >
                        {hook.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
      className="fixed inset-0 z-30 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-panel p-5"
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
          className="mt-4 w-full resize-none rounded-md border border-border bg-bg px-3 py-2 text-sm text-primary outline-none focus:border-accent"
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
