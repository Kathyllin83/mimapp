import "dotenv/config";
import { Pool, type QueryResultRow } from "pg";

declare global {
  var __mimaPool: Pool | undefined;
}

function getPool() {
  if (!process.env["DATABASE_URL"]) {
    throw new Error("DATABASE_URL não configurada");
  }
  return (globalThis.__mimaPool ??= new Pool({
    connectionString: process.env["DATABASE_URL"],
    max: 10,
    idleTimeoutMillis: 30_000,
  }));
}

export function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return getPool().query<T>(text, values);
}

export async function dbTransaction<T>(run: (client: import("pg").PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
