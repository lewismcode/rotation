-- Rotation initial schema.
-- Multi-tenant from day one: every tenant-owned row carries label_id and all
-- application queries MUST filter on it. Even at single-label MVP we never
-- assume one tenant.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Labels == Clerk Organizations.
CREATE TABLE IF NOT EXISTS labels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id  text UNIQUE NOT NULL,
  name          text NOT NULL,
  display_name  text NOT NULL,
  logo_url      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Users == Clerk Users within a label org (artists + label staff/admins).
CREATE TABLE IF NOT EXISTS users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id     text UNIQUE NOT NULL,
  label_id          uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  role              text NOT NULL DEFAULT 'artist' CHECK (role IN ('admin','artist')),
  theme_preference  text CHECK (theme_preference IN ('light','dark')),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_label_idx ON users(label_id);

CREATE TABLE IF NOT EXISTS hooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id    uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  text        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  -- Reserved for future AI vs manual sourcing (out of scope for MVP but modeled
  -- now so adding it later needs no migration).
  source      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS hooks_label_active_idx ON hooks(label_id, is_active);

CREATE TABLE IF NOT EXISTS batches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id            uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_by_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'uploading'
                        CHECK (status IN ('uploading','ready','processing','complete','failed')),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS batches_label_idx ON batches(label_id, created_at DESC);

CREATE TABLE IF NOT EXISTS clips (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id           uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  original_filename  text NOT NULL,
  r2_key_original    text NOT NULL,
  width              integer,
  height             integer,
  duration_seconds   real,
  needs_resize       boolean NOT NULL DEFAULT false,
  status             text NOT NULL DEFAULT 'uploading'
                       CHECK (status IN ('uploading','probing','ready','failed')),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clips_batch_idx ON clips(batch_id);

CREATE TABLE IF NOT EXISTS renders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id       uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  clip_id        uuid NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  hook_id        uuid NOT NULL REFERENCES hooks(id) ON DELETE CASCADE,
  r2_key_output  text,
  status         text NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued','processing','complete','failed')),
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  UNIQUE (batch_id, clip_id, hook_id)
);
CREATE INDEX IF NOT EXISTS renders_batch_idx ON renders(batch_id);
CREATE INDEX IF NOT EXISTS renders_status_idx ON renders(status);
