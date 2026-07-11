-- Soft-delete / archive. Archived batches (and standalone-removed clips)
-- disappear from the UI immediately but their R2 objects are retained until a
-- retention purge hard-deletes them after ARCHIVE_RETENTION_DAYS.
ALTER TABLE batches ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS batches_archived_idx ON batches(archived_at);
CREATE INDEX IF NOT EXISTS clips_archived_idx ON clips(archived_at);
