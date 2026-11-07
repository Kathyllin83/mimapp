import { dbQuery } from "../lib/server/db";
import type { ApiOffer } from "../lib/offers";
import { isVitrineStore, type VitrineStore } from "../lib/vitrines";
import { validateAffiliateLink } from "./affiliate";
import { parsePrice } from "./normalize";

/** Produto da vitrine cadastrado pelo dono do site (preço e link informados por ele). */
export interface ShowcaseItem {
  id: number;
  store: VitrineStore;
  title: string;
  image_url: string | null;
  price: number;
  old_price: number | null;
  affiliate_url: string;
  position: number;
  updated_at: string;
}

export interface ShowcaseInput {
  store: VitrineStore;
  title: string;
  image_url: string | null;
  price: number;
  old_price: number | null;
  affiliate_url: string;
}

export function validateShowcaseInput(
  body: Record<string, unknown>,
): { ok: true; value: ShowcaseInput } | { ok: false; error: string } {
  if (!isVitrineStore(body["store"])) return { ok: false, error: "Loja inválida." };
  const store = body["store"];
  const title = typeof body["title"] === "string" ? body["title"].trim() : "";
  if (title.length < 3 || title.length > 200)
    return { ok: false, error: "O título deve ter de 3 a 200 caracteres." };
  const price = parsePrice(body["price"]);
  if (price === null || price <= 0 || price > 1_000_000)
    return { ok: false, error: "Preço inválido." };
  const oldRaw = body["old_price"];
  const old = oldRaw === undefined || oldRaw === null || oldRaw === "" ? null : parsePrice(oldRaw);
  if (oldRaw !== undefined && oldRaw !== null && oldRaw !== "" && old === null) {
    return { ok: false, error: "Preço anterior inválido." };
  }
  if (old !== null && old <= price)
    return { ok: false, error: "O preço anterior deve ser maior que o preço atual." };
  let image: string | null = null;
  const imgRaw = typeof body["image_url"] === "string" ? body["image_url"].trim() : "";
  if (imgRaw) {
    try {
      if (new URL(imgRaw).protocol !== "https:") throw new Error();
      image = imgRaw;
    } catch {
      return { ok: false, error: "A imagem deve ser uma URL https." };
    }
  }
  const link = typeof body["affiliate_url"] === "string" ? body["affiliate_url"].trim() : "";
  const linkError = validateAffiliateLink(link, store);
  if (linkError) return { ok: false, error: linkError };
  return {
    ok: true,
    value: { store, title, image_url: image, price, old_price: old, affiliate_url: link },
  };
}

interface Row {
  id: string;
  store: VitrineStore;
  title: string;
  image_url: string | null;
  price: string;
  old_price: string | null;
  affiliate_url: string;
  position: number;
  updated_at: Date;
}
const toItem = (r: Row): ShowcaseItem => ({
  id: Number(r.id),
  store: r.store,
  title: r.title,
  image_url: r.image_url,
  price: Number(r.price),
  old_price: r.old_price === null ? null : Number(r.old_price),
  affiliate_url: r.affiliate_url,
  position: r.position,
  updated_at: r.updated_at.toISOString(),
});

export async function listShowcase(store?: VitrineStore): Promise<ShowcaseItem[]> {
  const { rows } = await dbQuery<Row>(
    `SELECT * FROM robot_showcase_items ${store ? "WHERE store = $1" : ""} ORDER BY store, position, id`,
    store ? [store] : [],
  );
  return rows.map(toItem);
}

export async function createShowcaseItem(v: ShowcaseInput): Promise<number> {
  const { rows } = await dbQuery<{ id: string }>(
    `INSERT INTO robot_showcase_items (store, title, image_url, price, old_price, affiliate_url, position)
     VALUES ($1,$2,$3,$4,$5,$6, COALESCE((SELECT max(position) + 1 FROM robot_showcase_items WHERE store = $1), 0))
     RETURNING id`,
    [v.store, v.title, v.image_url, v.price, v.old_price, v.affiliate_url],
  );
  return Number(rows[0]!.id);
}

export async function updateShowcaseItem(id: number, v: ShowcaseInput): Promise<boolean> {
  const r = await dbQuery(
    `UPDATE robot_showcase_items SET store = $2, title = $3, image_url = $4, price = $5,
       old_price = $6, affiliate_url = $7, updated_at = now() WHERE id = $1`,
    [id, v.store, v.title, v.image_url, v.price, v.old_price, v.affiliate_url],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function deleteShowcaseItem(id: number): Promise<boolean> {
  const r = await dbQuery("DELETE FROM robot_showcase_items WHERE id = $1", [id]);
  return (r.rowCount ?? 0) > 0;
}

/**
 * Formato público (mesmo dos cards de oferta). Preço e preço anterior são informados pelo dono,
 * então o desconto nunca é "validado": aparece como "preço informado".
 */
export function toPublicOffer(i: ShowcaseItem): ApiOffer {
  const pct = i.old_price ? Math.round((1 - i.price / i.old_price) * 10_000) / 100 : null;
  return {
    id: 1_000_000_000 + i.id, // não colide com os ids das ofertas do robô
    title: i.title,
    image_url: i.image_url,
    marketplace: i.store,
    category: null,
    topics: [],
    price: i.price,
    currency: "BRL",
    old_price: i.old_price,
    discount_pct: pct,
    discount_validated: false,
    score: 0,
    flags: pct ? ["discount_unvalidated"] : [],
    buy_url: i.affiliate_url,
    buy_url_is_affiliate: true,
    updated_at: i.updated_at,
  };
}
