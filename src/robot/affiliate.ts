import { dbQuery } from "../lib/server/db";
import { HISTORY } from "./config";
import { isAllowedAffiliateDomain, marketplaceFrom } from "./normalize";

/**
 * Cadastro do link de afiliado do dono do site, por produto.
 * Só valida o domínio e a loja; nunca monta nem altera parâmetros do link.
 */
export function validateAffiliateLink(raw: string, marketplace: string): string | null {
  const url = raw.trim();
  if (!isAllowedAffiliateDomain(url)) {
    return "Domínio não permitido (use https em amazon.com.br/amzn.to, mercadolivre.com.br/meli.la, shopee.com.br/shope.ee ou aliexpress.com/s.click.aliexpress.com).";
  }
  if (marketplaceFrom(new URL(url).hostname) !== marketplace) {
    return `O link não é da loja desta oferta (${marketplace}).`;
  }
  return null;
}

export type SetLinkResult = { ok: true; title: string } | { ok: false; error: string };

export async function setAffiliateLink(offerId: number, raw: string): Promise<SetLinkResult> {
  const { rows } = await dbQuery<{ dedupe_key: string; marketplace: string; title: string }>(
    "SELECT dedupe_key, marketplace, title FROM robot_offers WHERE id = $1",
    [offerId],
  );
  const offer = rows[0];
  if (!offer) return { ok: false, error: "Oferta não encontrada." };
  const error = validateAffiliateLink(raw, offer.marketplace);
  if (error) return { ok: false, error };
  await dbQuery(
    `INSERT INTO robot_affiliate_links (dedupe_key, url) VALUES ($1, $2)
     ON CONFLICT (dedupe_key) DO UPDATE SET url = EXCLUDED.url`,
    [offer.dedupe_key, raw.trim()],
  );
  return { ok: true, title: offer.title };
}

export async function removeAffiliateLink(offerId: number): Promise<boolean> {
  const r = await dbQuery(
    `DELETE FROM robot_affiliate_links WHERE dedupe_key = (SELECT dedupe_key FROM robot_offers WHERE id = $1)`,
    [offerId],
  );
  return (r.rowCount ?? 0) > 0;
}

export interface AdminOffer {
  id: number;
  title: string;
  image_url: string | null;
  marketplace: string;
  price: number;
  score: number;
  /** URL limpa do produto na loja (quando existe), para abrir e gerar o seu link. */
  store_url: string | null;
  affiliate_url: string | null;
}
export interface AdminList {
  data: AdminOffer[];
  total: number;
  current_page: number;
  last_page: number;
}

interface AdminRow {
  id: string;
  title: string;
  image_url: string | null;
  marketplace: string;
  price: string;
  score: number;
  store_url: string | null;
  affiliate_url: string | null;
  total: string;
}

export async function listForAdmin(opts: {
  marketplace?: string | null;
  onlyWithoutLink?: boolean;
  q?: string | null;
  page?: number;
  perPage?: number;
}): Promise<AdminList> {
  const perPage = Math.max(1, Math.min(200, opts.perPage ?? 50));
  const page = Math.max(1, opts.page ?? 1);
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.marketplace) {
    args.push(opts.marketplace);
    where.push(`marketplace = $${args.length}`);
  }
  if (opts.q) {
    args.push(`%${opts.q.replace(/[\\%_]/g, "\\$&")}%`);
    where.push(`title ILIKE $${args.length}`);
  }
  if (opts.onlyWithoutLink) where.push("affiliate_url IS NULL");
  args.push(perPage, (page - 1) * perPage);
  const { rows } = await dbQuery<AdminRow>(
    `WITH visible AS (
       SELECT o.*, a.url AS affiliate_url,
              max(o.clean_url) OVER (PARTITION BY o.dedupe_key) AS any_clean_url
       FROM robot_offers o LEFT JOIN robot_affiliate_links a USING (dedupe_key)
       WHERE o.source_status = 'active'
         AND o.last_seen_at > now() - make_interval(hours => ${HISTORY.expireAfterHours})
     ), best AS (
       SELECT DISTINCT ON (dedupe_key) *, COALESCE(clean_url, any_clean_url) AS store_url
       FROM visible ORDER BY dedupe_key, score DESC, updated_at DESC
     )
     SELECT id, title, image_url, marketplace, price, score, store_url, affiliate_url,
            count(*) OVER () AS total
     FROM best
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY (store_url IS NOT NULL) DESC, score DESC, id
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );
  const total = rows[0] ? Number(rows[0].total) : 0;
  return {
    data: rows.map((r) => ({
      id: Number(r.id),
      title: r.title,
      image_url: r.image_url,
      marketplace: r.marketplace,
      price: Number(r.price),
      score: r.score,
      store_url: r.store_url,
      affiliate_url: r.affiliate_url,
    })),
    total,
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
  };
}

/* ---------- planilha (CSV) ---------- */

const DELIM = ";"; // o Excel em português abre `;` corretamente; a importação aceita `,` também

export function cell(v: string | number | null): string {
  let s = v === null ? "" : String(v);
  // evita injeção de fórmula ao abrir no Excel/Sheets
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADER = [
  "id",
  "loja",
  "titulo",
  "preco",
  "url_do_produto",
  "seu_link_de_afiliado",
];

export async function exportCsv(opts: { onlyWithoutLink?: boolean } = {}): Promise<string> {
  const all: AdminOffer[] = [];
  for (let page = 1; ; page++) {
    const r = await listForAdmin({
      onlyWithoutLink: opts.onlyWithoutLink ?? true,
      page,
      perPage: 200,
    });
    all.push(...r.data);
    if (page >= r.last_page) break;
  }
  const lines = [CSV_HEADER.join(DELIM)];
  for (const o of all) {
    lines.push(
      [o.id, o.marketplace, o.title, o.price.toFixed(2), o.store_url, o.affiliate_url]
        .map(cell)
        .join(DELIM),
    );
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim =
    (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

export interface ImportReport {
  saved: number;
  skipped: number;
  errors: { line: number; error: string }[];
}

/** Lê a planilha exportada: usa as colunas `id` e `seu_link_de_afiliado`; linhas sem link são ignoradas. */
export async function importCsv(text: string): Promise<ImportReport> {
  const rows = parseCsv(text);
  const report: ImportReport = { saved: 0, skipped: 0, errors: [] };
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const idCol = header.indexOf("id");
  const linkCol = header.indexOf("seu_link_de_afiliado");
  if (idCol < 0 || linkCol < 0) {
    report.errors.push({
      line: 1,
      error: "Cabeçalho inválido: precisa das colunas id e seu_link_de_afiliado.",
    });
    return report;
  }
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const link = (r[linkCol] ?? "").trim();
    if (!link) {
      report.skipped++;
      continue;
    }
    const id = Number((r[idCol] ?? "").trim());
    if (!Number.isInteger(id) || id <= 0) {
      report.errors.push({ line: i + 1, error: "id inválido" });
      continue;
    }
    const res = await setAffiliateLink(id, link);
    if (res.ok) report.saved++;
    else report.errors.push({ line: i + 1, error: res.error });
  }
  return report;
}
