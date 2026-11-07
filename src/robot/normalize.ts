import type { MarketplaceSlug } from "./config";

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Título normalizado: sem acento, minúsculo, sem pontuação, palavras ordenadas. */
export function normalizeTitle(title: string): string {
  return stripAccents(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function dedupeKey(title: string, marketplace: MarketplaceSlug): string {
  return `${normalizeTitle(title)}|${marketplace}`;
}

/** Descarta preço riscado sentinela (< 1) ou que não seja maior que o preço atual. */
export function sanitizeOldPrice(price: number, old: number | null | undefined): number | null {
  if (old == null || !Number.isFinite(old)) return null;
  if (old < 1 || old <= price) return null;
  return old;
}

export function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const n = /,\d{1,2}$/.test(s) ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : null;
}

export function marketplaceFrom(...hints: (string | null | undefined)[]): MarketplaceSlug | null {
  const h = hints.filter(Boolean).join(" ").toLowerCase();
  if (/amazon|amzn/.test(h)) return "amazon";
  if (/mercado-?\s?livre|mercadolivre|meli/.test(h)) return "mercado-livre";
  if (/shopee|shope\.ee/.test(h)) return "shopee";
  if (/aliexpress/.test(h)) return "aliexpress";
  return null;
}

/**
 * URL limpa do produto. Só Amazon /dp/<ASIN> (sem query) ou página de produto do Mercado Livre.
 * Encurtadores (meli.la), tags de afiliado e qualquer outra coisa viram null.
 */
export function cleanProductUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase();
  if (/(^|\.)amazon\.com\.br$/.test(host)) {
    const m = u.pathname.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i);
    return m ? `https://www.amazon.com.br/dp/${m[1]!.toUpperCase()}` : null;
  }
  if (/(^|\.)mercadolivre\.com\.br$/.test(host)) {
    if (/\/(p|up)\/MLB[UA]?\d+/i.test(u.pathname) || /\/MLB-?\d+/i.test(u.pathname)) {
      return `https://${host}${u.pathname}`;
    }
    return null;
  }
  return null;
}

const AFFILIATE_DOMAINS = [
  /(^|\.)amazon\.com\.br$/,
  /^amzn\.to$/,
  /(^|\.)mercadolivre\.com\.br$/,
  /^meli\.la$/,
  /(^|\.)shopee\.com\.br$/,
  /^shope\.ee$/,
  /(^|\.)aliexpress\.com$/,
  /^s\.click\.aliexpress\.com$/,
];

/** Valida só o domínio do link de afiliado do dono do site (não promete comissão). */
export function isAllowedAffiliateDomain(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" && AFFILIATE_DOMAINS.some((re) => re.test(u.hostname.toLowerCase()))
    );
  } catch {
    return false;
  }
}

/** Código de associado da Amazon: letras/números/hífen terminando em -NN (ex.: "meusite-20"). */
const AMAZON_TAG_RE = /^[a-z0-9][a-z0-9-]{0,38}-\d{2}$/i;
export const isValidAmazonTag = (tag: string) => AMAZON_TAG_RE.test(tag.trim());

const AMAZON_DP_URL = /^https:\/\/www\.amazon\.com\.br\/dp\/[A-Z0-9]{10}$/;

/**
 * Link de afiliado da Amazon a partir da URL limpa do produto + o código de associado DO DONO do site.
 * Só o formato simples `?tag=`; nunca copia ids de rastreio de links de terceiros.
 */
export function amazonAffiliateUrl(
  cleanUrl: string | null | undefined,
  tag: string | null | undefined,
): string | null {
  if (!cleanUrl || !tag || !isValidAmazonTag(tag) || !AMAZON_DP_URL.test(cleanUrl)) return null;
  return `${cleanUrl}?tag=${tag.trim()}`;
}
