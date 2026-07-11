import { describe, it, expect } from "vitest";
import { isHdr, normalizeRotation } from "../ffmpeg.js";

describe("isHdr", () => {
  it("flags PQ / HDR10 / Dolby Vision", () => {
    expect(isHdr({ colorTransfer: "smpte2084", colorPrimaries: "bt2020" })).toBe(true);
  });

  it("flags HLG", () => {
    expect(isHdr({ colorTransfer: "arib-std-b67", colorPrimaries: null })).toBe(true);
  });

  it("flags BT.2020 primaries even without an HDR transfer", () => {
    expect(isHdr({ colorTransfer: "bt709", colorPrimaries: "bt2020" })).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isHdr({ colorTransfer: "SMPTE2084", colorPrimaries: null })).toBe(true);
  });

  it("does not flag standard SDR (bt709 / unknown / null)", () => {
    expect(isHdr({ colorTransfer: "bt709", colorPrimaries: "bt709" })).toBe(false);
    expect(isHdr({ colorTransfer: null, colorPrimaries: null })).toBe(false);
    expect(isHdr({ colorTransfer: "smpte170m", colorPrimaries: "smpte170m" })).toBe(false);
  });
});

describe("normalizeRotation", () => {
  it("passes through canonical angles", () => {
    for (const a of [0, 90, 180, 270]) expect(normalizeRotation(a)).toBe(a);
  });

  it("wraps negatives into 0..270 (iPhone display-matrix convention)", () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(-270)).toBe(90);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(450)).toBe(90);
  });

  it("snaps near-angles to the nearest 90", () => {
    expect(normalizeRotation(89)).toBe(90);
    expect(normalizeRotation(-89)).toBe(270);
  });

  it("treats missing / NaN as no rotation", () => {
    expect(normalizeRotation(undefined)).toBe(0);
    expect(normalizeRotation(null)).toBe(0);
    expect(normalizeRotation(Number.NaN)).toBe(0);
  });
});
