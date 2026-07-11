-- Per-render caption style. Chosen at the hook-selection step and applied to
-- every render in the batch. Defaults to 'poster'. New styles can be added to
-- the app's style registry without a migration; only the CHECK list grows.
ALTER TABLE renders
  ADD COLUMN IF NOT EXISTS caption_style text NOT NULL DEFAULT 'poster'
    CHECK (caption_style IN (
      'poster','classic','strong','modern','bubble','deco',
      'squeeze','neon','typewriter','signature','editor'
    ));
