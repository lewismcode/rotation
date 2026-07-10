/** Domain types shared between web and worker. Mirrors the SQL schema. */

export type UserRole = "admin" | "artist";
export type ThemePreference = "light" | "dark";
export type BatchStatus =
  | "uploading"
  | "ready"
  | "processing"
  | "complete"
  | "failed";
export type ClipStatus = "uploading" | "probing" | "ready" | "failed";
export type RenderStatus = "queued" | "processing" | "complete" | "failed";

export interface Label {
  id: string;
  clerk_org_id: string;
  name: string;
  display_name: string;
  logo_url: string | null;
  created_at: string;
}

export interface User {
  id: string;
  clerk_user_id: string;
  label_id: string;
  role: UserRole;
  theme_preference: ThemePreference | null;
  created_at: string;
}

export interface Hook {
  id: string;
  label_id: string;
  text: string;
  is_active: boolean;
  /** Reserved for future AI vs manual sourcing — kept nullable now. */
  source: "manual" | "ai";
  created_at: string;
  created_by: string | null;
}

export interface Batch {
  id: string;
  label_id: string;
  created_by_user_id: string;
  status: BatchStatus;
  created_at: string;
}

export interface Clip {
  id: string;
  batch_id: string;
  original_filename: string;
  r2_key_original: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  needs_resize: boolean;
  status: ClipStatus;
  created_at: string;
}

export interface Render {
  id: string;
  batch_id: string;
  clip_id: string;
  hook_id: string;
  r2_key_output: string | null;
  status: RenderStatus;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

/** Job payloads for the queue. */
export interface ProbeJob {
  clipId: string;
  labelId: string;
}

export interface RenderJob {
  renderId: string;
  labelId: string;
}

export interface ZipJob {
  batchId: string;
  labelId: string;
}
