import { describe, it, expect } from "vitest";
import {
  anchorExpr,
  buildCompositeGraph,
  escFilterPath,
  TONEMAP,
} from "../filters.js";

describe("anchorExpr", () => {
  it("formats to 4 decimals", () => {
    expect(anchorExpr(0.5)).toBe("0.5000");
    expect(anchorExpr(0)).toBe("0.0000");
    expect(anchorExpr(1)).toBe("1.0000");
  });

  it("clamps out-of-range and non-finite values", () => {
    expect(anchorExpr(-3)).toBe("0.0000");
    expect(anchorExpr(9)).toBe("1.0000");
    expect(anchorExpr(Number.NaN)).toBe("0.5000");
  });
});

describe("escFilterPath", () => {
  it("escapes the characters ffmpeg's movie= filter treats specially", () => {
    expect(escFilterPath("/tmp/a:b/hook's.png")).toBe("/tmp/a\\:b/hook\\'s.png");
  });
});

describe("buildCompositeGraph", () => {
  const base = { overlayPath: "/tmp/hook.png", anchor: { x: 0.5, y: 0.5 } };

  it("cover-scales to 1080x1920 and center-crops by default", () => {
    const g = buildCompositeGraph({ ...base, tonemap: false });
    expect(g).toContain("scale=1080:1920:force_original_aspect_ratio=increase");
    expect(g).toContain("crop=1080:1920:(iw-1080)*0.5000:(ih-1920)*0.5000");
    expect(g).toContain("format=yuv420p");
    expect(g).toContain("[b][h]overlay=0:0");
  });

  it("moves the crop anchor for off-center framing", () => {
    const left = buildCompositeGraph({ ...base, anchor: { x: 0, y: 0.5 }, tonemap: false });
    expect(left).toContain("(iw-1080)*0.0000");
    const right = buildCompositeGraph({ ...base, anchor: { x: 1, y: 0.5 }, tonemap: false });
    expect(right).toContain("(iw-1080)*1.0000");
  });

  it("prepends the tonemap chain only when hdr", () => {
    expect(buildCompositeGraph({ ...base, tonemap: false }).startsWith(TONEMAP)).toBe(false);
    const hdr = buildCompositeGraph({ ...base, tonemap: true });
    expect(hdr.startsWith(TONEMAP)).toBe(true);
    expect(hdr).toContain("tonemap=tonemap=hable");
  });

  it("escapes the overlay path inside movie=", () => {
    const g = buildCompositeGraph({ ...base, overlayPath: "/t/a:b.png", tonemap: false });
    expect(g).toContain("movie='/t/a\\:b.png'");
  });
});
