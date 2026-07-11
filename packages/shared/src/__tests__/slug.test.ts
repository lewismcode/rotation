import { describe, it, expect } from "vitest";
import { slugify, stemOf, outputFilename } from "../slug.js";
import { batchDisplayName } from "../types.js";
import {
  getCaptionStyle,
  isCaptionStyle,
  CAPTION_STYLE_IDS,
  DEFAULT_CAPTION_STYLE,
} from "../captionStyles.js";

describe("slugify", () => {
  it("lowercases, strips punctuation, and dashes gaps", () => {
    expect(slugify("POV: you just dropped a hit!")).toBe("pov-you-just-dropped-a-hit");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
  });

  it("never returns an empty slug", () => {
    expect(slugify("!!!")).toBe("hook");
    expect(slugify("")).toBe("hook");
  });

  it("trims trailing dashes after truncation", () => {
    expect(slugify("a".repeat(50), 40)).toHaveLength(40);
    expect(slugify("word ".repeat(20), 12).endsWith("-")).toBe(false);
  });
});

describe("stemOf", () => {
  it("strips path and extension", () => {
    expect(stemOf("/Users/x/clips/IMG_1208.MOV")).toBe("IMG_1208");
    expect(stemOf("clip.final.mp4")).toBe("clip.final");
  });

  it("keeps dotfiles intact", () => {
    expect(stemOf(".gitignore")).toBe(".gitignore");
  });
});

describe("outputFilename", () => {
  it("joins clip stem and hook slug with a .mp4 extension", () => {
    expect(outputFilename("IMG_1208.MOV", "POV: it's giving main character")).toBe(
      "img-1208__pov-it-s-giving-main-character.mp4"
    );
  });
});

describe("batchDisplayName", () => {
  it("prefers a custom name", () => {
    expect(batchDisplayName({ id: "abc123def", name: "Summer Drop", label_seq: 4 })).toBe(
      "Summer Drop"
    );
  });

  it("falls back to Batch {seq}", () => {
    expect(batchDisplayName({ id: "abc123def", name: null, label_seq: 4 })).toBe("Batch 4");
    expect(batchDisplayName({ id: "abc123def", name: "  ", label_seq: 7 })).toBe("Batch 7");
  });

  it("falls back to a short id when no seq", () => {
    expect(batchDisplayName({ id: "abc123def456", name: null, label_seq: null })).toBe(
      "Batch abc123"
    );
  });
});

describe("caption styles", () => {
  it("resolves a known style", () => {
    expect(getCaptionStyle("neon").id).toBe("neon");
  });

  it("falls back to the default for unknown/empty", () => {
    expect(getCaptionStyle("does-not-exist").id).toBe(DEFAULT_CAPTION_STYLE);
    expect(getCaptionStyle(null).id).toBe(DEFAULT_CAPTION_STYLE);
    expect(getCaptionStyle(undefined).id).toBe(DEFAULT_CAPTION_STYLE);
  });

  it("has a config for every declared id and a valid default", () => {
    expect(isCaptionStyle(DEFAULT_CAPTION_STYLE)).toBe(true);
    for (const id of CAPTION_STYLE_IDS) {
      expect(getCaptionStyle(id).id).toBe(id);
    }
  });
});
