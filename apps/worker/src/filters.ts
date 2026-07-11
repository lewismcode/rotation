import { REELS } from "@rotation/shared";

/**
 * Pure ffmpeg filtergraph builders — no ffmpeg/canvas imports, so the exact
 * crop/tonemap/overlay string can be unit-tested without spawning anything.
 */

export interface CropAnchor {
  /** Normalized 0..1 horizontal anchor (0 = left, 1 = right, 0.5 = center). */
  x: number;
  /** Normalized 0..1 vertical anchor (0 = top, 1 = bottom, 0.5 = center). */
  y: number;
}

// HDR (PQ/HLG, BT.2020) -> SDR (BT.709). Linearize, tone-map highlights with
// Hable, then convert back to bt709 tv-range before the normal scale/crop.
export const TONEMAP =
  "zscale=t=linear:npl=100,tonemap=tonemap=hable:desat=0," +
  "zscale=t=bt709:m=bt709:p=bt709:r=tv,";

// Escape a path for use inside ffmpeg's movie= filter argument.
export function escFilterPath(p: string): string {
  return p.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
}

// Clamp + format a normalized anchor for an ffmpeg expression. toFixed avoids
// locale/scientific-notation surprises in the filter string.
export function anchorExpr(v: number): string {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5)).toFixed(4);
}

/**
 * Build the single-pass composite graph:
 *   [optional HDR tonemap] -> cover-scale to 1080x1920 -> anchored crop ->
 *   force 8-bit -> overlay the caption PNG.
 * After the cover-scale exactly one axis overflows; the crop x/y pan along it,
 * and (iw-W)/(ih-H) is 0 on the other axis so its anchor is a no-op.
 */
export function buildCompositeGraph(opts: {
  overlayPath: string;
  anchor: CropAnchor;
  tonemap: boolean;
}): string {
  const { WIDTH, HEIGHT } = REELS;
  const ax = anchorExpr(opts.anchor.x);
  const ay = anchorExpr(opts.anchor.y);
  return (
    `${opts.tonemap ? TONEMAP : ""}` +
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${WIDTH}:${HEIGHT}:(iw-${WIDTH})*${ax}:(ih-${HEIGHT})*${ay},` +
    `format=yuv420p,setsar=1[b];` +
    `movie='${escFilterPath(opts.overlayPath)}'[h];[b][h]overlay=0:0`
  );
}
