/** Lojas que têm vitrine (AliExpress e "todas as lojas" não têm). Código seguro para o navegador. */
export const VITRINE_STORES = ["amazon", "mercado-livre", "shopee"] as const;
export type VitrineStore = (typeof VITRINE_STORES)[number];

export interface Vitrine {
  store: VitrineStore;
  url: string;
  title: string | null;
  height: number;
}

export const isVitrineStore = (s: unknown): s is VitrineStore =>
  typeof s === "string" && (VITRINE_STORES as readonly string[]).includes(s);

/** Shopee share links redirect through a custom app scheme that browsers may not have registered. */
export function isShopeeShortLink(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === "s.shopee.com.br" || host === "shope.ee" || host === "shopee.ee";
  } catch {
    return false;
  }
}

/** Só URLs https (a vitrine é embutida num quadro na aba da loja). */
export function validateVitrine(input: {
  url: unknown;
  title?: unknown;
  height?: unknown;
}): { ok: true; url: string; title: string | null; height: number } | { ok: false; error: string } {
  const raw = typeof input.url === "string" ? input.url.trim() : "";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: "URL inválida." };
  }
  if (u.protocol !== "https:") return { ok: false, error: "Use uma URL https." };
  const title =
    typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 80) : null;
  const h =
    input.height === undefined || input.height === "" || input.height === null
      ? 900
      : Number(input.height);
  if (!Number.isInteger(h) || h < 300 || h > 3000) {
    return { ok: false, error: "A altura deve ficar entre 300 e 3000 px." };
  }
  return { ok: true, url: u.href, title, height: h };
}

/**
 * Lojas que não permitem ser exibidas dentro de outro site (X-Frame-Options / frame-ancestors).
 * Links dessas lojas abrem em nova aba em vez de num quadro.
 */
const NOT_EMBEDDABLE_HOSTS = [
  /(^|\.)amazon\.com\.br$/,
  /^amzn\.to$/,
  /(^|\.)mercadolivre\.com\.br$/,
  /^meli\.la$/,
  /(^|\.)shopee\.com\.br$/,
  /^shope\.ee$/,
  /(^|\.)aliexpress\.com$/,
];

export function isEmbeddable(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !NOT_EMBEDDABLE_HOSTS.some((re) => re.test(host));
  } catch {
    return false;
  }
}
