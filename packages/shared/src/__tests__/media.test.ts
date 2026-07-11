import { describe, it, expect } from "vitest";
import {
  displayDimensions,
  needsResize,
  buildRenderPairs,
} from "../media.js";

describe("displayDimensions", () => {
  it("keeps dimensions for unrotated footage", () => {
    expect(displayDimensions(1920, 1080, 0)).toEqual({ width: 1920, height: 1080 });
  });

  it("swaps w/h for 90 and 270 (portrait phone shot landscape)", () => {
    expect(displayDimensions(1920, 1080, 90)).toEqual({ width: 1080, height: 1920 });
    expect(displayDimensions(1920, 1080, 270)).toEqual({ width: 1080, height: 1920 });
  });

  it("does not swap for 180", () => {
    expect(displayDimensions(1920, 1080, 180)).toEqual({ width: 1920, height: 1080 });
  });
});

describe("needsResize", () => {
  it("is false for exact 9:16", () => {
    expect(needsResize(1080, 1920)).toBe(false);
    expect(needsResize(720, 1280)).toBe(false); // same aspect, lower res -> upscale only
  });

  it("is true for landscape", () => {
    expect(needsResize(1920, 1080)).toBe(true);
  });

  it("is true for square and other non-9:16", () => {
    expect(needsResize(1080, 1080)).toBe(true);
    expect(needsResize(1080, 1350)).toBe(true); // 4:5
  });

  it("is false for degenerate/zero dimensions", () => {
    expect(needsResize(0, 1920)).toBe(false);
    expect(needsResize(1080, 0)).toBe(false);
  });
});

describe("buildRenderPairs", () => {
  it("produces clips x hooks pairings", () => {
    const pairs = buildRenderPairs(["c1", "c2"], ["h1", "h2", "h3"]);
    expect(pairs).toHaveLength(6);
  });

  it("is clip-major and covers every combination exactly once", () => {
    const pairs = buildRenderPairs(["c1", "c2"], ["h1", "h2"]);
    expect(pairs).toEqual([
      { clipId: "c1", hookId: "h1" },
      { clipId: "c1", hookId: "h2" },
      { clipId: "c2", hookId: "h1" },
      { clipId: "c2", hookId: "h2" },
    ]);
    const keys = new Set(pairs.map((p) => `${p.clipId}:${p.hookId}`));
    expect(keys.size).toBe(pairs.length);
  });

  it("is empty when either side is empty", () => {
    expect(buildRenderPairs([], ["h1"])).toEqual([]);
    expect(buildRenderPairs(["c1"], [])).toEqual([]);
  });
});
