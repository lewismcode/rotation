import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./client.js";

/**
 * Dead-simple forward-only migration runner. Applies every .sql file in
 * ./migrations in lexical order, tracking applied files in a table. Idempotent.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

async function run() {
  const p = pool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows } = await p.query<{ name: string }>("SELECT name FROM _migrations");
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`· skip   ${file}`);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    const client = await p.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations(name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`✓ apply  ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`✗ failed ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }
  await p.end();
  console.log("Migrations up to date.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
