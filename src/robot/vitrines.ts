import { dbQuery } from "../lib/server/db";
import type { Vitrine, VitrineStore } from "../lib/vitrines";

export * from "../lib/vitrines";

export async function listVitrines(): Promise<Vitrine[]> {
  const { rows } = await dbQuery<Vitrine>("SELECT store, url, title, height FROM robot_vitrines");
  return rows;
}

export async function setVitrine(
  store: VitrineStore,
  v: { url: string; title: string | null; height: number },
) {
  await dbQuery(
    `INSERT INTO robot_vitrines (store, url, title, height, updated_at) VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (store) DO UPDATE SET url = EXCLUDED.url, title = EXCLUDED.title,
       height = EXCLUDED.height, updated_at = now()`,
    [store, v.url, v.title, v.height],
  );
}

export async function removeVitrine(store: VitrineStore) {
  await dbQuery("DELETE FROM robot_vitrines WHERE store = $1", [store]);
}
