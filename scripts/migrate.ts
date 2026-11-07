import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dbQuery } from "../src/lib/server/db";

const migrationsDir = resolve("db/migrations");
const migrations = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
for (const migration of migrations) {
  await dbQuery(await readFile(resolve(migrationsDir, migration), "utf8"));
  console.log(`Applied ${migration}`);
}
process.exit(0);
