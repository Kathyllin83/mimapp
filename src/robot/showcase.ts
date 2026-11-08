import { dbQuery } from "../lib/server/db";
import type { ApiOffer } from "../lib/offers";
import { isVitrineStore, type VitrineStore } from "../lib/vitrines";
import { cell, parseCsv, validateAffiliateLink } from "./affiliate";
import { importFromShopeeUrl } from "../services/server/shopeeAffiliateService";
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
  /** página do produto na loja (uso interno: atualização de preço pela API oficial) */
  source_url: string | null;
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
  source_url: string | null;
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
  let source: string | null = null;
  const srcRaw = typeof body["source_url"] === "string" ? body["source_url"].trim() : "";
  if (srcRaw) {
    try {
      if (new URL(srcRaw).protocol !== "https:") throw new Error();
      source = srcRaw.slice(0, 500);
    } catch {
      return { ok: false, error: "A página do produto deve ser uma URL https." };
    }
  }
  const link = typeof body["affiliate_url"] === "string" ? body["affiliate_url"].trim() : "";
  const linkError = validateAffiliateLink(link, store);
  if (linkError) return { ok: false, error: linkError };
  return {
    ok: true,
    value: {
      store,
      title,
      image_url: image,
      price,
      old_price: old,
      affiliate_url: link,
      source_url: source,
    },
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
  source_url: string | null;
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
  source_url: r.source_url,
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
    `INSERT INTO robot_showcase_items (store, title, image_url, price, old_price, affiliate_url, source_url, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE((SELECT max(position) + 1 FROM robot_showcase_items WHERE store = $1), 0))
     RETURNING id`,
    [v.store, v.title, v.image_url, v.price, v.old_price, v.affiliate_url, v.source_url],
  );
  return Number(rows[0]!.id);
}

export async function updateShowcaseItem(id: number, v: ShowcaseInput): Promise<boolean> {
  const r = await dbQuery(
    `UPDATE robot_showcase_items SET store = $2, title = $3, image_url = $4, price = $5,
       old_price = $6, affiliate_url = $7, source_url = COALESCE($8, source_url), updated_at = now() WHERE id = $1`,
    [id, v.store, v.title, v.image_url, v.price, v.old_price, v.affiliate_url, v.source_url],
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

/* ---------- planilha (CSV) ---------- */

export const SHOWCASE_CSV_HEADER = [
  "id",
  "loja",
  "titulo",
  "preco",
  "preco_anterior",
  "url_da_imagem",
  "seu_link_de_afiliado",
];
const MAX_CSV_ROWS = 500;

export async function exportShowcaseCsv(): Promise<string> {
  const items = await listShowcase();
  const lines = [SHOWCASE_CSV_HEADER.join(";")];
  for (const i of items) {
    lines.push(
      [
        i.id,
        i.store,
        i.title,
        i.price.toFixed(2),
        i.old_price?.toFixed(2) ?? null,
        i.image_url,
        i.affiliate_url,
      ]
        .map(cell)
        .join(";"),
    );
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export interface ShowcaseCsvRow {
  line: number;
  id: number | null;
  body: Record<string, unknown>;
}

/** Converte a planilha em linhas de cadastro (sem tocar no banco). Linhas totalmente vazias são ignoradas. */
export function parseShowcaseCsv(text: string): {
  rows: ShowcaseCsvRow[];
  errors: { line: number; error: string }[];
} {
  const grid = parseCsv(text);
  const header = (grid[0] ?? []).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const errors: { line: number; error: string }[] = [];
  const need = ["loja", "titulo", "preco", "seu_link_de_afiliado"];
  const missing = need.filter((n) => col(n) < 0);
  if (missing.length) {
    return {
      rows: [],
      errors: [{ line: 1, error: `Cabeçalho inválido: faltam as colunas ${missing.join(", ")}.` }],
    };
  }
  if (grid.length - 1 > MAX_CSV_ROWS) {
    return {
      rows: [],
      errors: [{ line: 1, error: `A planilha tem mais de ${MAX_CSV_ROWS} linhas.` }],
    };
  }
  const rows: ShowcaseCsvRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i]!;
    const get = (name: string) => (r[col(name)] ?? "").trim();
    const idRaw = col("id") >= 0 ? get("id") : "";
    let id: number | null = null;
    if (idRaw) {
      id = Number(idRaw);
      if (!Number.isInteger(id) || id <= 0) {
        errors.push({ line: i + 1, error: "id inválido" });
        continue;
      }
    }
    rows.push({
      line: i + 1,
      id,
      body: {
        store: get("loja"),
        title: get("titulo"),
        price: get("preco"),
        old_price: col("preco_anterior") >= 0 ? get("preco_anterior") : "",
        image_url: col("url_da_imagem") >= 0 ? get("url_da_imagem") : "",
        affiliate_url: get("seu_link_de_afiliado"),
      },
    });
  }
  return { rows, errors };
}

export interface ShowcaseImportReport {
  created: number;
  updated: number;
  errors: { line: number; error: string }[];
}

/** Importa a planilha: linha sem id cria um produto; com id atualiza o produto existente. */
export async function importShowcaseCsv(text: string): Promise<ShowcaseImportReport> {
  const { rows, errors } = parseShowcaseCsv(text);
  const report: ShowcaseImportReport = { created: 0, updated: 0, errors: [...errors] };
  for (const row of rows) {
    const v = validateShowcaseInput(row.body);
    if (!v.ok) {
      report.errors.push({ line: row.line, error: v.error });
      continue;
    }
    if (row.id === null) {
      await createShowcaseItem(v.value);
      report.created++;
    } else if (await updateShowcaseItem(row.id, v.value)) {
      report.updated++;
    } else {
      report.errors.push({ line: row.line, error: `Produto ${row.id} não encontrado` });
    }
  }
  return report;
}

export interface RefreshReport {
  checked: number;
  changed: number;
  failed: { id: number; title: string; error: string }[];
}

/**
 * Confere na API oficial da Shopee o preço dos produtos da vitrine que têm a página de origem salva.
 * Atualiza o preço (e a data de atualização) só quando a consulta dá certo; falhas não mexem no produto.
 */
export async function refreshShopeePrices(
  opts: { fetchImpl?: typeof fetch; pauseMs?: number } = {},
): Promise<RefreshReport> {
  const items = (await listShowcase("shopee")).filter((i) => i.source_url);
  const report: RefreshReport = { checked: 0, changed: 0, failed: [] };
  for (const item of items) {
    try {
      const p = await importFromShopeeUrl(item.source_url!, opts.fetchImpl);
      const price = parsePrice(p.price);
      if (price === null || price <= 0) throw new Error("preço não encontrado");
      report.checked++;
      if (Math.abs(price - item.price) > 0.001) report.changed++;
      await dbQuery(
        `UPDATE robot_showcase_items SET price = $2, updated_at = now(),
           old_price = CASE WHEN old_price IS NOT NULL AND old_price <= $2 THEN NULL ELSE old_price END
         WHERE id = $1`,
        [item.id, price],
      );
    } catch (e) {
      report.failed.push({
        id: item.id,
        title: item.title,
        error: e instanceof Error ? e.message : "erro",
      });
    }
    await new Promise((r) => setTimeout(r, opts.pauseMs ?? 400));
  }
  return report;
}
