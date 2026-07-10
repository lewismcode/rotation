import { pool } from "./client.js";
import * as labelsRepo from "./repositories/labels.js";
import * as hooksRepo from "./repositories/hooks.js";

/**
 * Seeds starter hook examples for a label. In production the label row is
 * auto-provisioned from Clerk on first login; for local dev we ensure a demo
 * label exists so there's something to attach hooks to.
 *
 * Set SEED_CLERK_ORG_ID to point the seed at the real Clerk org id once you've
 * created the org in Clerk. Otherwise a placeholder demo label is used.
 *
 * All hook text is placeholder — clearly marked examples the label will replace.
 */
const STARTER_HOOKS = [
  "wait for the drop 🔊",
  "POV: you found your new favorite artist",
  "nobody is talking about this song",
  "this is the part that goes crazy",
  "turn your sound on for this one",
  "you weren't supposed to hear this yet",
  "the way this hits different at 2am",
  "save this before it blows up",
  "tell me this doesn't give you chills",
  "run it back one more time",
  "this loop is dangerously good",
  "how is this not viral already",
  "raw take, no autotune",
  "we made this in one night",
  "the bridge changes everything",
];

async function run() {
  const clerkOrgId = process.env.SEED_CLERK_ORG_ID ?? "seed-demo-org";

  const label = await labelsRepo.upsertLabel({
    clerkOrgId,
    name: "Demo Label",
    displayName: "Demo Label",
    logoUrl: null,
  });
  console.log(`Label ready: ${label.display_name} (${label.id})`);

  const existing = await hooksRepo.listHooks(label.id);
  if (existing.length > 0) {
    console.log(`Label already has ${existing.length} hooks — skipping seed.`);
    await pool().end();
    return;
  }

  for (const text of STARTER_HOOKS) {
    await hooksRepo.createHook({ labelId: label.id, text, createdBy: null });
  }
  console.log(`Seeded ${STARTER_HOOKS.length} starter hooks.`);
  await pool().end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
