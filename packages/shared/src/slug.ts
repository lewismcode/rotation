/**
 * Human-readable output filenames: `{original_clip_name}__{hook_slug}.mp4`.
 * Keeps the original clip stem so the artist recognizes the source, plus a
 * short slug of the hook so a folder of outputs is scannable.
 */

// Combining diacritical marks range (U+0300–U+036F) left over after NFKD.
const COMBINING_MARKS = /[̀-ͯ]/g;

export function slugify(input: string, maxLen = 40): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");
  return slug || "hook";
}

/** Strip the extension from an uploaded filename to use as a stem. */
export function stemOf(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, "");
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

export function outputFilename(originalFilename: string, hookText: string): string {
  const stem = slugify(stemOf(originalFilename), 60);
  const hook = slugify(hookText, 40);
  return `${stem}__${hook}.mp4`;
}
