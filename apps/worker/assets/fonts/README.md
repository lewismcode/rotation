# Caption fonts

Drop a **bold** sans-serif TTF/OTF here to control the caption look with full
fidelity (the spec suggests something close to Instagram's — e.g. Inter Bold or
Helvetica Bold). Any `.ttf`/`.otf` in this folder is auto-registered by
`src/overlay/font.ts`.

If none is present, the renderer falls back to a system bold font, and finally
to a generic sans-serif — rendering still works, but the look may drift from IG.

You can also point `FONT_PATH` at a specific file instead of dropping it here.

Suggested: `Inter-Bold.ttf` (SIL Open Font License).
