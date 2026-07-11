"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Creates an empty batch then routes into its flow.
export function NewBatchButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch("/api/batches", { method: "POST" });
      if (!res.ok) throw new Error("Could not start batch");
      const { batch } = await res.json();
      router.push(`/batches/${batch.id}`);
    } catch (err) {
      setLoading(false);
      alert(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <button
      onClick={start}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-medium text-[#141310] shadow-lg shadow-[var(--accent-soft)] transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-60"
    >
      <span className="text-base leading-none">+</span>
      {loading ? "Starting…" : "New batch"}
    </button>
  );
}
