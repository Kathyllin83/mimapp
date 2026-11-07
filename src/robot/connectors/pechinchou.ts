import { PECHINCHOU_PAGES } from "../config";
import { cleanProductUrl, marketplaceFrom, parsePrice, sanitizeOldPrice } from "../normalize";
import { StructureChangedError, type NormalizedOffer } from "../types";
import { asRecord, asString, clampPct, pageProps, type Connector } from "./shared";

const BASE = "https://www.pechinchou.com.br";

export function parsePechinchou(html: string): NormalizedOffer[] {
  const props = pageProps(html);
  const rows = asRecord(props["promos"])?.["results"] ?? asRecord(props["products"])?.["results"];
  if (!Array.isArray(rows))
    throw new StructureChangedError("promos.results / products.results ausentes");
  const out: NormalizedOffer[] = [];
  let essentialMissing = 0;
  for (const raw of rows) {
    const o = asRecord(raw);
    if (!o) continue;
    const id = o["id"];
    const title = asString(o["title"]);
    const slug = asString(o["slug"]);
    const price = parsePrice(o["price"]);
    if ((typeof id !== "number" && typeof id !== "string") || !title || !slug || price === null) {
      essentialMissing++;
      continue;
    }
    if (price <= 0) continue;
    const store = asRecord(o["store"]);
    const marketplace = marketplaceFrom(
      asString(store?.["slug"]),
      asString(store?.["slug_url"]),
      asString(store?.["name"]),
    );
    if (!marketplace) continue;
    const sub = asRecord(o["subcategory"]);
    const image = asString(o["image"]);
    const engagement =
      (Number(o["tot_likes_and_dislikes"]) || 0) +
      (Number(o["total_comment"]) || 0) * 2 +
      (Number(o["count_of_views"]) || 0) / 50;
    // long_url/short_url trazem a tag de afiliado deles: lidos só para extrair uma URL limpa, nunca gravados.
    out.push({
      source: "pechinchou",
      externalId: String(id),
      title,
      imageUrl: image && /^https?:\/\//.test(image) ? image : null,
      marketplace,
      category: asString(asRecord(sub?.["category"])?.["name"]),
      subcategory: asString(sub?.["slug"]),
      price,
      oldPrice: sanitizeOldPrice(price, parsePrice(o["old_price"])),
      status: o["status"] === "CLOSED" ? "closed" : "active",
      popularity: clampPct(engagement),
      sourceUrl: `${BASE}/oferta/${slug}`,
      cleanUrl: cleanProductUrl(asString(o["long_url"])),
    });
  }
  if (rows.length > 0 && out.length === 0 && essentialMissing === rows.length) {
    throw new StructureChangedError("campos essenciais das ofertas não reconhecidos");
  }
  return out;
}

export function subcategoryUrlsFromSitemap(xml: string, pages: string[]): string[] {
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]!);
  return urls.filter((u) => pages.some((p) => u.endsWith(`/categorias/${p}`)));
}

export const pechinchou: Connector = {
  id: "pechinchou",
  async pages(client) {
    const urls = [`${BASE}/`];
    const res = await client.get(`${BASE}/sitemap/category-and-subcategory.xml`);
    if (res.kind !== "ok") return { stop: res };
    urls.push(...subcategoryUrlsFromSitemap(res.body, PECHINCHOU_PAGES));
    return { urls };
  },
  parse: (html) => parsePechinchou(html),
};
