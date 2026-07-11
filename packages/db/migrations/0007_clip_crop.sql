-- Manual crop anchor for clips that get reframed to 9:16. Normalized 0..1 on
-- each axis; 0.5/0.5 is centered, which is exactly the previous behaviour, so
-- existing rows keep their current framing. Only the overflowing axis actually
-- moves at render time (the cover-crop leaves the other axis with no slack).
ALTER TABLE clips ADD COLUMN IF NOT EXISTS crop_anchor_x real NOT NULL DEFAULT 0.5;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS crop_anchor_y real NOT NULL DEFAULT 0.5;
