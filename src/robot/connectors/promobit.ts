import { PROMOBIT_CATEGORY_SLUGS } from "../config";
import { marketplaceFrom, parsePrice, sanitizeOldPrice } from "../normalize";
import { StructureChangedError, type NormalizedOffer } from "../types";
import { asRecord, asString, clampPct, pageProps, type Connector } from "./shared";

const BASE = "https://www.promobit.com.br";
const IMG = "https://i.promobit.com.br";

export function parsePromobit(html: string): NormalizedOffer[] {
  const props = pageProps(html);
  const featured = props["serverFeaturedOffers"];
  const listed = asRecord(props["serverOffers"])?.["offers"];
  if (!Array.isArray(featured) && !Array.isArray(listed)) {
    throw new StructureChangedError("serverOffers.offers / serverFeaturedOffers ausentes");
  }
  const rows = [
    ...(Array.isArray(featured) ? featured : []),
    ...(Array.isArray(listed) ? listed : []),
  ];
  const category = asString(asRecord(props["category"])?.["categoryName"]);
  const out: NormalizedOffer[] = [];
  let essentialMissing = 0;
  for (const raw of rows) {
    const o = asRecord(raw);
    if (!o) continue;
    const id = o["offerId"];
    const title = asString(o["offerTitle"]);
    const slug = asString(o["offerSlug"]);
    const price = parsePrice(o["offerPrice"]);
    if ((typeof id !== "number" && typeof id !== "string") || !title || !slug || price === null) {
      essentialMissing++;
      continue;
    }
    // Só preço normal: STARTING_AT/FREE/COUPON não representam o preço final.
    if (o["offerPriceType"] !== undefined && o["offerPriceType"] !== "NORMAL") continue;
    if (price <= 0) continue;
    const marketplace = marketplaceFrom(
      asString(o["storeDomain"]),
      asString(o["storeParam"]),
      asString(o["storeName"]),
    );
    if (!marketplace) continue; // fora das 4 lojas
    const photo = asString(o["offerPhoto"]);
    const statusName = asString(o["offerStatusName"]) ?? "";
    out.push({
      source: "promobit",
      externalId: String(id),
      title,
      imageUrl: photo
        ? photo.startsWith("http")
          ? photo
          : `${IMG}${photo.startsWith("/") ? "" : "/"}${photo}`
        : null,
      marketplace,
      category,
      subcategory: null,
      price,
      oldPrice: sanitizeOldPrice(price, parsePrice(o["offerOldPrice"])),
      status: /expirad|encerrad|esgotad|inativ/i.test(statusName) ? "closed" : "active",
      popularity: clampPct(Number(o["offerEngagementScore"]) || 0),
      sourceUrl: `${BASE}/oferta/${slug}`,
      cleanUrl: null, // o link da loja passa por redirecionador de afiliado: não resolvemos
    });
  }
  if (rows.length > 0 && out.length === 0 && essentialMissing === rows.length) {
    throw new StructureChangedError("campos essenciais das ofertas não reconhecidos");
  }
  return out;
}

export const promobit: Connector = {
  id: "promobit",
  async pages() {
    return { urls: PROMOBIT_CATEGORY_SLUGS.map((c) => `${BASE}/promocoes/${c}/`) };
  },
  parse: (html) => parsePromobit(html),
};
