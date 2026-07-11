import { pool, query } from "./client.js";
import * as labelsRepo from "./repositories/labels.js";
import * as hooksRepo from "./repositories/hooks.js";
import { STARTER_HOOKS } from "@rotation/shared";
import type { Label } from "@rotation/shared";

/**
 * Adds the starter hook library to a label (idempotent — only inserts hooks not
 * already present, never renames an existing label).
 *
 * Target resolution:
 *   - SEED_CLERK_ORG_ID set  → that org's label (created as a placeholder if
 *     it doesn't exist yet, for local dev)
 *   - unset + exactly one label → that label
 *   - unset + no labels → a demo label (local dev)
 *   - unset + multiple labels → error (set SEED_CLERK_ORG_ID to choose)
 */
async function resolveLabel(): Promise<Label> {
  const orgId = process.env.SEED_CLERK_ORG_ID;
  if (orgId) {
    const existing = await labelsRepo.getLabelByClerkOrg(orgId);
    if (existing) return existing;
    return labelsRepo.upsertLabel({
      clerkOrgId: orgId,
      name: "Demo Label",
      displayName: "Demo Label",
      logoUrl: null,
    });
  }
  const { rows } = await query<Label>(
    "SELECT * FROM labels ORDER BY created_at ASC"
  );
  if (rows.length === 1) return rows[0]!;
  if (rows.length === 0) {
    return labelsRepo.upsertLabel({
      clerkOrgId: "seed-demo-org",
      name: "Demo Label",
      displayName: "Demo Label",
      logoUrl: null,
    });
  }
  throw new Error(
    `Found ${rows.length} labels — set SEED_CLERK_ORG_ID to choose which one to seed.`
  );
}

async function run() {
  const label = await resolveLabel();
  const added = await hooksRepo.addMissingHooks(label.id, STARTER_HOOKS);
  console.log(
    `Label "${label.display_name}": added ${added.length} starter hooks ` +
      `(${STARTER_HOOKS.length - added.length} already present).`
  );
  await pool().end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
