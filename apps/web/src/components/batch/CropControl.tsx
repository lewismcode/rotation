"use client";

import { useCallback, useRef, useState } from "react";
import type { Clip } from "@rotation/shared/types";
import { REELS } from "@rotation/shared/constants";

/**
 * Drag-to-reframe control for a clip that will be cropped to 9:16. The source
 * video is shown at its true (display) aspect ratio and a 9:16 window is dragged
 * along whichever axis overflows. We persist a normalized anchor (0..1); the
 * worker turns it into the crop x/y offset at render time.
 *
 * Only one axis ever moves: after a cover-scale to 1080x1920, exactly one
 * dimension overflows. A wider-than-9:16 clip pans horizontally; a taller one
 * pans vertically. The other axis has no slack, so its anchor is left centered.
 */
export function CropControl({ clip }: { clip: Clip }) {
  const w = clip.width ?? 0;
  const h = clip.height ?? 0;
  const boxRef = useRef<HTMLDivElement>(null);
  const [anchorX, setAnchorX] = useState(clip.crop_anchor_x ?? 0.5);
  const [anchorY, setAnchorY] = useState(clip.crop_anchor_y ?? 0.5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayAspect = w > 0 && h > 0 ? w / h : REELS.ASPECT;
  const target = REELS.ASPECT; // 9:16 ≈ 0.5625
  const horizontal = displayAspect > target;
  // Window size as a fraction of the shown video along the overflow axis.
  const windowFrac = horizontal ? target / displayAspect : displayAspect / target;
  const slack = Math.max(0, 1 - windowFrac);

  const save = useCallback(async (x: number, y: number) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clips/${clip.id}/crop`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({}));
        throw new Error(msg || "Couldn't save crop");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [clip.id]);

  const dragging = useRef(false);

  const moveTo = useCallback(
    (clientX: number, clientY: number) => {
      const box = boxRef.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      if (horizontal) {
        const pf = (clientX - rect.left) / rect.width; // pointer as window center
        const left = Math.min(slack, Math.max(0, pf - windowFrac / 2));
        setAnchorX(slack > 0 ? left / slack : 0.5);
      } else {
        const pf = (clientY - rect.top) / rect.height;
        const top = Math.min(slack, Math.max(0, pf - windowFrac / 2));
        setAnchorY(slack > 0 ? top / slack : 0.5);
      }
    },
    [horizontal, slack, windowFrac]
  );

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    moveTo(e.clientX, e.clientY);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragging.current) moveTo(e.clientX, e.clientY);
  }
  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    void save(anchorX, anchorY);
  }

  // Window position (as % of the box) from the anchor.
  const leftPct = horizontal ? anchorX * slack * 100 : 0;
  const topPct = horizontal ? 0 : anchorY * slack * 100;
  const wPct = horizontal ? windowFrac * 100 : 100;
  const hPct = horizontal ? 100 : windowFrac * 100;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-secondary">
          Drag the frame to choose what stays in the 9:16 crop
        </span>
        <span className="data text-[11px] text-faint">
          {saving ? "saving…" : error ? error : "auto-saved"}
        </span>
      </div>
      <div
        ref={boxRef}
        className="relative mx-auto overflow-hidden rounded-lg bg-black touch-none select-none"
        style={{ aspectRatio: String(displayAspect), maxHeight: 320 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={`/api/clips/${clip.id}/source`}
          className="pointer-events-none h-full w-full object-contain"
          preload="auto"
          muted
          playsInline
        />
        {/* the 9:16 window — dims everything outside via a huge shadow spread */}
        <div
          className={`absolute rounded-sm border-2 border-white/90 ${
            horizontal ? "cursor-ew-resize" : "cursor-ns-resize"
          }`}
          style={{
            left: `${leftPct}%`,
            top: `${topPct}%`,
            width: `${wPct}%`,
            height: `${hPct}%`,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      </div>
    </div>
  );
}
