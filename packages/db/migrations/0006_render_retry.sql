-- Retry count for failed renders. A one-click retry re-enqueues just that
-- clip x hook, resets status -> queued and clears the error, and bumps this
-- counter so we can cap manual retries (after which we tell the user to reach
-- out instead of letting them spin forever on a genuinely broken clip).
ALTER TABLE renders ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0;
