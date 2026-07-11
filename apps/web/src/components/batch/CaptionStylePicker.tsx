"use client";

import type { CSSProperties } from "react";
import {
  CAPTION_STYLES,
  type CaptionStyle,
  type CaptionStyleConfig,
} from "@rotation/shared/caption-styles";

const SAMPLE = "wait for it";

/**
 * Visual caption-style picker. Each tile previews the sample hook in that
 * style's actual font + treatment on a dark, video-like swatch, so the choice
 * reads at a glance. Styles are named by their own names (Poster, Bubble, …).
 */
export function CaptionStylePicker({
  value,
  onChange,
  locked,
}: {
  value: CaptionStyle;
  onChange: (id: CaptionStyle) => void;
  locked: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium text-primary">Caption style</span>
        <span className="data text-xs text-faint">
          {CAPTION_STYLES.find((s) => s.id === value)?.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CAPTION_STYLES.map((style) => {
          const selected = style.id === value;
          return (
            <button
              key={style.id}
              type="button"
              disabled={locked}
              onClick={() => onChange(style.id)}
              className="group flex flex-col overflow-hidden rounded-md border text-left transition-colors"
              style={{
                borderColor: selected ? "var(--accent)" : "var(--border)",
                cursor: locked ? "default" : "pointer",
              }}
            >
              <div
                className="relative grid h-16 place-items-center px-2"
                style={{
                  // Dark, video-like swatch so previews read like a real Reel.
                  background:
                    "linear-gradient(135deg, #2a2620 0%, #14110c 100%)",
                }}
              >
                <PreviewText style={style} />
              </div>
              <div
                className="flex items-center justify-between px-2 py-1.5"
                style={{
                  background: selected
                    ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                    : "transparent",
                }}
              >
                <span className="text-xs font-medium text-primary">
                  {style.label}
                </span>
                {selected ? (
                  <span
                    className="data text-[10px]"
                    style={{ color: "var(--accent)" }}
                  >
                    ✓
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PreviewText({ style }: { style: CaptionStyleConfig }) {
  const base: CSSProperties = {
    fontFamily: style.family,
    color: style.color,
    textTransform: style.case === "upper" ? "uppercase" : "none",
    letterSpacing: `${style.letterSpacing * 0.35}px`,
    fontStyle: style.italic ? "italic" : "normal",
    fontSize: `${Math.round(15 * Math.min(style.sizeScale, 1.25))}px`,
    lineHeight: 1.1,
    textAlign: style.align === "left" ? "left" : "center",
    whiteSpace: "nowrap",
    maxWidth: "100%",
  };

  if (style.treatment === "glow" && style.glowColor) {
    base.textShadow = `0 0 8px ${style.glowColor}, 0 0 16px ${style.glowColor}`;
  } else if (style.treatment === "shadow") {
    base.textShadow = "0 1px 3px rgba(0,0,0,0.7)";
  }

  if (style.treatment === "pill" && style.pillColor) {
    return (
      <span
        style={{
          ...base,
          background: style.pillColor,
          padding: "2px 8px",
          borderRadius: "6px",
        }}
      >
        {SAMPLE}
      </span>
    );
  }
  return <span style={base}>{SAMPLE}</span>;
}
