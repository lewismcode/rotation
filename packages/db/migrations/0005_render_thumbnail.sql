-- Per-render thumbnail (a single frame extracted at ~1s, stored in R2) so the
-- delivery grid can show a visual preview instead of filename-only rows.
ALTER TABLE renders ADD COLUMN IF NOT EXISTS thumbnail_r2_key text;
