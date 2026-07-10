import { GlobalFonts } from "@napi-rs/canvas";
import { existsSync } from "node:fs";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * The overlay needs a bold sans-serif that resembles IG's native caption font.
 * We resolve one in priority order so it works out of the box in most
 * containers, and register it under a stable family name.
 *
 * To pin an exact font (recommended for production fidelity), drop a bold TTF
 * at apps/worker/assets/fonts/ or set FONT_PATH.
 */
export const HOOK_FONT_FAMILY = "RotationHook";

let registered = false;

function candidatePaths(): string[] {
  const bundled = join(__dirname, "..", "..", "assets", "fonts");
  const bundledFonts = existsSync(bundled)
    ? readdirSync(bundled)
        .filter((f) => /\.(ttf|otf)$/i.test(f))
        .map((f) => join(bundled, f))
    : [];

  return [
    ...(process.env.FONT_PATH ? [process.env.FONT_PATH] : []),
    ...bundledFonts,
    // Common system bold sans locations across distros.
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
  ];
}

/** Returns the family name to use in canvas ctx.font. */
export function ensureHookFont(): string {
  if (registered) return HOOK_FONT_FAMILY;
  for (const p of candidatePaths()) {
    try {
      if (p && existsSync(p)) {
        GlobalFonts.registerFromPath(p, HOOK_FONT_FAMILY);
        registered = true;
        return HOOK_FONT_FAMILY;
      }
    } catch {
      // try next candidate
    }
  }
  // No bundled/system font found — fall back to whatever canvas resolves for
  // sans-serif. Rendering still succeeds; fidelity may vary.
  console.warn(
    "[overlay] No bold TTF found; falling back to generic sans-serif. " +
      "Drop a bold font at apps/worker/assets/fonts/ or set FONT_PATH for IG-accurate captions."
  );
  registered = true;
  return "sans-serif";
}
