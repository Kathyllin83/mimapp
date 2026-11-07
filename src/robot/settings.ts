import { dbQuery } from "../lib/server/db";
import { isValidAmazonTag } from "./normalize";

const AMAZON_TAG_KEY = "amazon_tag";
let cache: { value: string | null; at: number } | null = null;

/** Código de associado da Amazon: configuração do admin; AMAZON_ASSOCIATE_TAG serve de reserva. */
export async function getAmazonTag(): Promise<string | null> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  let value: string | null = null;
  try {
    const { rows } = await dbQuery<{ value: string }>(
      "SELECT value FROM robot_settings WHERE key = $1",
      [AMAZON_TAG_KEY],
    );
    value = rows[0]?.value ?? null;
  } catch {
    value = null; // tabela ainda não migrada: cai na variável de ambiente
  }
  value ??= process.env["AMAZON_ASSOCIATE_TAG"] ?? null;
  if (value && !isValidAmazonTag(value)) value = null;
  cache = { value, at: Date.now() };
  return value;
}

export async function setAmazonTag(tag: string): Promise<void> {
  await dbQuery(
    `INSERT INTO robot_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [AMAZON_TAG_KEY, tag.trim()],
  );
  cache = null;
}

export async function removeAmazonTag(): Promise<void> {
  await dbQuery("DELETE FROM robot_settings WHERE key = $1", [AMAZON_TAG_KEY]);
  cache = null;
}
