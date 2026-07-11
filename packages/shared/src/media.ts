import { REELS, ASPECT_TOLERANCE } from "./constants.js";

/**
 * Pure media helpers shared by the probe and render steps. Kept free of any
 * ffmpeg/DB dependency so the exact rules (reframe decision, fan-out pairing)
 * can be unit-tested in isolation.
 */

/**
 * Display dimensions: a clip coded landscape with a 90/270 rotation flag (a
 * portrait phone video) is actually shown portrait, so swap w/h in that case.
 */
export function displayDimensions(
  width: number,
  height: number,
  rotation: number
): { width: number; height: number } {
  const rotated = rotation === 90 || rotation === 270;
  return rotated
    ? { width: height, height: width }
    : { width, height };
}

/**
 * Does this clip need reframing to 9:16? Keys off aspect only — a same-aspect
 * clip at a different resolution is just upscaled, no crop warning warranted.
 */
export function needsResize(displayW: number, displayH: number): boolean {
  if (displayW <= 0 || displayH <= 0) return false;
  const aspect = displayW / displayH;
  return Math.abs(aspect - REELS.ASPECT) > ASPECT_TOLERANCE;
}

/** Fan-out: every clip x every hook, in a stable clip-major order. */
export function buildRenderPairs(
  clipIds: string[],
  hookIds: string[]
): Array<{ clipId: string; hookId: string }> {
  return clipIds.flatMap((clipId) =>
    hookIds.map((hookId) => ({ clipId, hookId }))
  );
}
