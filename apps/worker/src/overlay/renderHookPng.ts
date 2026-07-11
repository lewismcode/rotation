import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import {
  REELS,
  getCaptionStyle,
  type CaptionStyleConfig,
} from "@rotation/shared";
import { ensureFonts, familyFor } from "./font.js";

/**
 * Render a hook caption to a full-frame transparent PNG that ffmpeg composites
 * over the video. Every style shares the same position (upper third, IG-safe
 * margins) and only differs in text rendering, driven entirely by the shared
 * CaptionStyleConfig — so this function never branches on a specific style id
 * and new styles need no changes here.
 */

const BASE_FONT = 62; // px on a 1080-wide frame
const TOP_FRACTION = 0.26; // block top, upper third
const MAX_WIDTH_FRACTION = 0.86;
const LEFT_MARGIN_FRACTION = 0.08;
const ITALIC_SHEAR = -0.2;

// Bundled fonts have no color-emoji glyphs (Apple's are proprietary), which
// renders emoji as a "tofu" box. Strip emoji, variation selectors, ZWJ joiners
// and regional-indicator flags from the caption, then tidy leftover whitespace.
const EMOJI_RE =
  /(?:\p{Extended_Pictographic}|️|‍|[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}])/gu;

function stripEmoji(text: string): string {
  return text.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
}

function applyCase(text: string, c: CaptionStyleConfig["case"]): string {
  return c === "upper" ? text.toUpperCase() : text;
}

function lineWidth(ctx: SKRSContext2D, text: string, ls: number): number {
  if (ls === 0) return ctx.measureText(text).width;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + ls;
  return Math.max(0, w - ls);
}

function wrapLines(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  ls: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (lineWidth(ctx, candidate, ls) <= maxWidth || !current) {
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
  ctx: SKRSContext2D,
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

/** Draw one line at baseline (0,0) in a translated/sheared context. */
function drawChars(ctx: SKRSContext2D, text: string, ls: number) {
  if (ls === 0) {
    ctx.fillText(text, 0, 0);
    return;
  }
  let x = 0;
  for (const ch of text) {
    ctx.fillText(ch, x, 0);
    x += ctx.measureText(ch).width + ls;
  }
}

export function renderHookPng(
  text: string,
  styleId?: string,
  frame: { width: number; height: number } = {
    width: REELS.WIDTH,
    height: REELS.HEIGHT,
  }
): Buffer {
  ensureFonts();
  const style = getCaptionStyle(styleId);
  const family = familyFor(style.family);

  const canvas = createCanvas(frame.width, frame.height);
  const ctx = canvas.getContext("2d");

  const fontSize = Math.round(BASE_FONT * style.sizeScale);
  const lineHeight = Math.round(fontSize * 1.32);
  const ls = style.letterSpacing;
  ctx.font = `${fontSize}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const content = applyCase(stripEmoji(text), style.case);
  if (!content) return canvas.toBuffer("image/png"); // emoji-only hook → no caption
  const maxTextWidth = frame.width * MAX_WIDTH_FRACTION;
  const lines = wrapLines(ctx, content, maxTextWidth, ls);

  const centerX = frame.width / 2;
  const leftX = frame.width * LEFT_MARGIN_FRACTION;
  let y = frame.height * TOP_FRACTION;

  for (const line of lines) {
    const w = lineWidth(ctx, line, ls);
    const startX = style.align === "left" ? leftX : centerX - w / 2;

    if (style.treatment === "pill" && style.pillColor) {
      const padX = fontSize * 0.42;
      const padY = fontSize * 0.22;
      ctx.fillStyle = style.pillColor;
      roundRect(
        ctx,
        startX - padX,
        y - lineHeight / 2,
        w + padX * 2,
        lineHeight,
        fontSize * 0.28
      );
      ctx.fill();
    }

    ctx.save();
    ctx.translate(startX, y);
    if (style.italic) ctx.transform(1, 0, ITALIC_SHEAR, 1, 0, 0);

    if (style.treatment === "glow" && style.glowColor) {
      // Blurred duplicate behind, radius scales with size; layered for punch.
      ctx.shadowColor = style.glowColor;
      ctx.shadowBlur = fontSize * 0.7;
      ctx.fillStyle = style.glowColor;
      for (let i = 0; i < 3; i++) drawChars(ctx, line, ls);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    } else if (style.treatment === "shadow") {
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = Math.max(4, fontSize * 0.12);
      ctx.shadowOffsetY = 2;
    }

    ctx.fillStyle = style.color;
    drawChars(ctx, line, ls);
    ctx.restore();

    y += lineHeight + fontSize * 0.14;
  }

  return canvas.toBuffer("image/png");
}
