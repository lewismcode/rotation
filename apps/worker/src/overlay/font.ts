import { GlobalFonts } from "@napi-rs/canvas";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CAPTION_STYLES } from "@rotation/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STYLES_DIR = join(__dirname, "..", "..", "assets", "fonts", "styles");
const BASE_DIR = join(__dirname, "..", "..", "assets", "fonts");

/** Generic fallback family, used if a style's own font file is missing. */
export const FALLBACK_FAMILY = "RotationFallback";

let ready = false;
const registered = new Set<string>();

/**
 * Register every caption-style font (one TTF per style) under its family name,
 * plus a bold fallback. Idempotent. Called once before the first render.
 */
export function ensureFonts(): void {
  if (ready) return;

  // Per-style fonts.
  for (const style of CAPTION_STYLES) {
    const path = join(STYLES_DIR, style.fontFile);
    if (existsSync(path)) {
      try {
        GlobalFonts.registerFromPath(path, style.family);
        registered.add(style.family);
      } catch {
        /* skip a bad font file; render falls back below */
      }
    }
  }

  // Fallback: prefer a bundled bold TTF, else FONT_PATH, else any base TTF.
  const fallbackCandidates = [
    process.env.FONT_PATH,
    join(BASE_DIR, "LiberationSans-Bold.ttf"),
    join(BASE_DIR, "DejaVuSans-Bold.ttf"),
    ...(existsSync(BASE_DIR)
      ? readdirSync(BASE_DIR)
          .filter((f) => /\.(ttf|otf)$/i.test(f))
          .map((f) => join(BASE_DIR, f))
      : []),
  ].filter(Boolean) as string[];

  for (const p of fallbackCandidates) {
    if (existsSync(p)) {
      try {
        GlobalFonts.registerFromPath(p, FALLBACK_FAMILY);
        registered.add(FALLBACK_FAMILY);
        break;
      } catch {
        /* try next */
      }
    }
  }

  ready = true;
}

/** The family to use for a style, falling back if its font didn't register. */
export function familyFor(family: string): string {
  return registered.has(family) ? family : FALLBACK_FAMILY;
}
