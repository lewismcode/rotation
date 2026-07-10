import { query } from "../client.js";
import type { Label } from "@rotation/shared";

export async function getLabelByClerkOrg(clerkOrgId: string): Promise<Label | null> {
  const { rows } = await query<Label>(
    "SELECT * FROM labels WHERE clerk_org_id = $1",
    [clerkOrgId]
  );
  return rows[0] ?? null;
}

export async function getLabel(id: string): Promise<Label | null> {
  const { rows } = await query<Label>("SELECT * FROM labels WHERE id = $1", [id]);
  return rows[0] ?? null;
}

/** Upsert a label from Clerk org data (used on first request / webhook). */
export async function upsertLabel(input: {
  clerkOrgId: string;
  name: string;
  displayName: string;
  logoUrl?: string | null;
}): Promise<Label> {
  const { rows } = await query<Label>(
    `INSERT INTO labels (clerk_org_id, name, display_name, logo_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (clerk_org_id) DO UPDATE
       SET name = EXCLUDED.name,
           display_name = EXCLUDED.display_name,
           logo_url = EXCLUDED.logo_url
     RETURNING *`,
    [input.clerkOrgId, input.name, input.displayName, input.logoUrl ?? null]
  );
  return rows[0]!;
}
