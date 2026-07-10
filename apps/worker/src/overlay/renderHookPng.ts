import { createCanvas } from "@napi-rs/canvas";
import { REELS } from "@rotation/shared";
import { ensureHookFont } from "./font.js";

/**
 * IG-native caption style, rendered to a full-frame transparent PNG that ffmpeg
 * composites over the video. Keeping this a pure function of (text, options)
 * makes it the single swap point when styling becomes customizable later.
 *
 * Style: bold white sans-serif, wrapped and centered, each line sitting on a
 * semi-transparent dark rounded pill for legibility against any footage, with a
 * soft shadow. Positioned in the upper third — where a creator's typed-on
 * caption naturally lands on a Reel.
 */
export interface HookStyle {
  fontSize: number;
  lineHeight: number;
  paddingX: number;
  paddingY: number;
  radius: number;
  /** Fraction of frame height where the text block's top edge starts. */
  topFraction: number;
  maxWidthFraction: number;
  pill: string;
  text: string;
  shadow: string;
}

export const DEFAULT_HOOK_STYLE: HookStyle = {
  fontSize: 62,
  lineHeight: 84,
  paddingX: 26,
  paddingY: 12,
  radius: 14,
  topFraction: 0.26,
  maxWidthFraction: 0.84,
  pill: "rgba(0, 0, 0, 0.42)",
  text: "#ffffff",
  shadow: "rgba(0, 0, 0, 0.55)",
};

function wrapLines(
  ctx: import("@napi-rs/canvas").SKRSContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(
  ctx: import("@napi-rs/canvas").SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function renderHookPng(
  text: string,
  style: HookStyle = DEFAULT_HOOK_STYLE,
  frame: { width: number; height: number } = {
    width: REELS.WIDTH,
    height: REELS.HEIGHT,
  }
): Buffer {
  const family = ensureHookFont();
  const canvas = createCanvas(frame.width, frame.height);
  const ctx = canvas.getContext("2d");

  ctx.font = `bold ${style.fontSize}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  const maxTextWidth =
    frame.width * style.maxWidthFraction - style.paddingX * 2;
  const lines = wrapLines(ctx, text, maxTextWidth);

  const centerX = frame.width / 2;
  let y = frame.height * style.topFraction;

  for (const line of lines) {
    const metrics = ctx.measureText(line);
    const pillW = metrics.width + style.paddingX * 2;
    const pillH = style.lineHeight;
    const pillX = centerX - pillW / 2;
    const pillY = y - pillH / 2;

    // pill background
    ctx.fillStyle = style.pill;
    roundRect(ctx, pillX, pillY, pillW, pillH, style.radius);
    ctx.fill();

    // text with soft shadow for legibility
    ctx.shadowColor = style.shadow;
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = style.text;
    ctx.fillText(line, centerX, y);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    y += style.lineHeight + 8;
  }

  return canvas.toBuffer("image/png");
}
