-- Persist the HDR flag detected at probe time so the render step doesn't have
-- to re-run a full ffprobe just to decide whether to tone-map. Defaults false;
-- clips probed before this migration render as SDR (correct for the vast
-- majority) until re-uploaded.
ALTER TABLE clips ADD COLUMN IF NOT EXISTS is_hdr boolean NOT NULL DEFAULT false;
