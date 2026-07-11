/**
 * Caption styles — the single source of truth shared by the worker renderer and
 * the UI style picker. Each entry is a self-contained config (font, case,
 * alignment, color, treatment) so a new style is one array entry and never
 * touches the others. Position is intentionally NOT here: every style renders in
 * the upper third within IG-safe margins; only the text rendering changes.
 *
 * Font names are the style's own names (Poster, Bubble, …) — never described as
 * "official Instagram fonts".
 */

export const CAPTION_STYLE_IDS = [
  "poster",
  "classic",
  "strong",
  "modern",
  "bubble",
  "deco",
  "squeeze",
  "neon",
  "typewriter",
  "signature",
  "editor",
] as const;

export type CaptionStyle = (typeof CAPTION_STYLE_IDS)[number];

export const DEFAULT_CAPTION_STYLE: CaptionStyle = "poster";

export function isCaptionStyle(v: unknown): v is CaptionStyle {
  return typeof v === "string" && (CAPTION_STYLE_IDS as readonly string[]).includes(v);
}

export type TextCase = "none" | "upper";
export type TextAlign = "center" | "left";
export type Treatment = "shadow" | "pill" | "glow";

export interface CaptionStyleConfig {
  id: CaptionStyle;
  /** Display label shown in the picker. */
  label: string;
  /** TTF filename in apps/worker/assets/fonts/styles and apps/web/public/fonts. */
  fontFile: string;
  /** Canvas family name the worker registers it under. */
  family: string;
  case: TextCase;
  align: TextAlign;
  /** Multiplier on the base font size (base ≈ 62px on a 1080-wide frame). */
  sizeScale: number;
  /** Extra tracking in px at base size (negative = tighter). */
  letterSpacing: number;
  /** Fake-italic via horizontal skew (for faces with no italic cut). */
  italic: boolean;
  color: string;
  treatment: Treatment;
  /** For treatment "pill". */
  pillColor?: string;
  /** For treatment "glow". */
  glowColor?: string;
  /** One-word hint shown under the label in the picker. */
  hint: string;
}

// Accent/gold tones. Accent mirrors the default theme amber; per-label theming
// can override at render time later.
const ACCENT = "#c9982e";
const GOLD = "#d8b45a";
const OFFWHITE = "#fdfcf8";
const WHITE = "#ffffff";
const INK = "#141310";

export const CAPTION_STYLES: CaptionStyleConfig[] = [
  {
    id: "poster",
    label: "Poster",
    fontFile: "Poster.ttf",
    family: "RotationPoster",
    case: "none",
    align: "center",
    sizeScale: 1.12,
    letterSpacing: 0,
    italic: false,
    color: OFFWHITE,
    treatment: "shadow",
    hint: "Bold display serif",
  },
  {
    id: "classic",
    label: "Classic",
    fontFile: "Classic.ttf",
    family: "RotationClassic",
    case: "none",
    align: "center",
    sizeScale: 1.0,
    letterSpacing: 0,
    italic: false,
    color: WHITE,
    treatment: "shadow",
    hint: "Clean sans",
  },
  {
    id: "strong",
    label: "Strong",
    fontFile: "Strong.ttf",
    family: "RotationStrong",
    case: "none",
    align: "center",
    sizeScale: 0.94,
    letterSpacing: 0,
    italic: true,
    color: INK,
    treatment: "pill",
    pillColor: ACCENT,
    hint: "Bold italic on a pill",
  },
  {
    id: "modern",
    label: "Modern",
    fontFile: "Modern.ttf",
    family: "RotationModern",
    case: "upper",
    align: "center",
    sizeScale: 0.92,
    letterSpacing: -1,
    italic: false,
    color: WHITE,
    treatment: "shadow",
    hint: "Uppercase, tight",
  },
  {
    id: "bubble",
    label: "Bubble",
    fontFile: "Bubble.ttf",
    family: "RotationBubble",
    case: "none",
    align: "center",
    sizeScale: 1.02,
    letterSpacing: 0,
    italic: false,
    color: WHITE,
    treatment: "shadow",
    hint: "Rounded, soft",
  },
  {
    id: "deco",
    label: "Deco",
    fontFile: "Deco.ttf",
    family: "RotationDeco",
    case: "none",
    align: "center",
    sizeScale: 0.82,
    letterSpacing: 4,
    italic: false,
    color: GOLD,
    treatment: "shadow",
    hint: "Wide, metallic",
  },
  {
    id: "squeeze",
    label: "Squeeze",
    fontFile: "Squeeze.ttf",
    family: "RotationSqueeze",
    case: "upper",
    align: "center",
    sizeScale: 1.3,
    letterSpacing: 1,
    italic: false,
    color: WHITE,
    treatment: "shadow",
    hint: "Tall condensed caps",
  },
  {
    id: "neon",
    label: "Neon",
    fontFile: "Neon.ttf",
    family: "RotationNeon",
    case: "none",
    align: "center",
    sizeScale: 1.05,
    letterSpacing: 0,
    italic: false,
    color: WHITE,
    treatment: "glow",
    glowColor: ACCENT,
    hint: "Script with glow",
  },
  {
    id: "typewriter",
    label: "Typewriter",
    fontFile: "Typewriter.ttf",
    family: "RotationTypewriter",
    case: "none",
    align: "left",
    sizeScale: 0.9,
    letterSpacing: 0,
    italic: false,
    color: WHITE,
    treatment: "shadow",
    hint: "Mono, left-aligned",
  },
  {
    id: "signature",
    label: "Signature",
    fontFile: "Signature.ttf",
    family: "RotationSignature",
    case: "none",
    align: "center",
    sizeScale: 1.2,
    letterSpacing: 0,
    italic: false,
    color: WHITE,
    treatment: "shadow",
    hint: "Handwritten",
  },
  {
    id: "editor",
    label: "Editor",
    fontFile: "Editor.ttf",
    family: "RotationEditor",
    case: "none",
    align: "center",
    sizeScale: 0.72,
    letterSpacing: 3,
    italic: false,
    color: OFFWHITE,
    treatment: "shadow",
    hint: "Tracked serif, small",
  },
];

const BY_ID = new Map(CAPTION_STYLES.map((s) => [s.id, s]));

export function getCaptionStyle(id: string | null | undefined): CaptionStyleConfig {
  return (
    (isCaptionStyle(id) ? BY_ID.get(id) : undefined) ??
    BY_ID.get(DEFAULT_CAPTION_STYLE)!
  );
}
