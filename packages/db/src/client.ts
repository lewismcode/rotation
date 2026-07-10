import pg from "pg";
import { serverEnv } from "@rotation/shared";

// Reuse a single pool per process. In Next dev the module can be re-evaluated,
// so we stash it on globalThis to avoid exhausting connections on hot reload.
const globalForPg = globalThis as unknown as { __rotationPool?: pg.Pool };

export function pool(): pg.Pool {
  if (globalForPg.__rotationPool) return globalForPg.__rotationPool;
  const p = new pg.Pool({
    connectionString: serverEnv().DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  globalForPg.__rotationPool = p;
  return p;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool().query<T>(text, params as never[]);
}

/** Run a set of statements inside a transaction. */
export async function tx<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
