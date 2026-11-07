// Aplica as migrations de db/migrations/*.sql ainda não registradas. JavaScript puro (sem tsx),
// para rodar no início do servidor em produção: `node scripts/migrate-prod.mjs && node .output/...`
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não configurada");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const dir = resolve("db/migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set(
    (await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name),
  );
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(resolve(dir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
      applied++;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Falha em ${file}:`, error.message);
      process.exit(1);
    }
  }
  console.log(applied ? `${applied} migration(s) aplicada(s)` : "Banco já está atualizado");
} finally {
  await client.end();
}
