-- Human-friendly batch identity. label_seq gives each batch a per-label ordinal
-- ("Batch 12") instead of a raw UUID; name is an optional custom label.
ALTER TABLE batches ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS label_seq integer;

-- Backfill existing rows: number them per label by creation order.
WITH ordered AS (
  SELECT id,
         row_number() OVER (PARTITION BY label_id ORDER BY created_at, id) AS rn
  FROM batches
)
UPDATE batches b
   SET label_seq = o.rn
  FROM ordered o
 WHERE o.id = b.id AND b.label_seq IS NULL;

CREATE INDEX IF NOT EXISTS batches_label_seq_idx ON batches(label_id, label_seq);
