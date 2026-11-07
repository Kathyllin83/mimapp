export type SourceId = "promobit" | "pechinchou";
export type MarketplaceSlug = "amazon" | "mercado-livre" | "shopee" | "aliexpress";
export const MARKETPLACE_SLUGS: MarketplaceSlug[] = [
  "amazon",
  "mercado-livre",
  "shopee",
  "aliexpress",
];

/** User-Agent honesto e fixo. O contato vem de ROBOT_CONTACT (url ou e-mail do dono do site). */
export function userAgent(contact = process.env["ROBOT_CONTACT"]): string {
  if (!contact)
    throw new Error("Defina ROBOT_CONTACT (URL ou e-mail de contato) para identificar o robô.");
  return `MimaBot/1.0 (+${contact})`;
}

export const MIN_HOST_INTERVAL_MS = 5_000;
export const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_BODY_BYTES = 3_000_000;

export const CRAWL_INTERVAL_MIN = 30;
export const CRAWL_INTERVAL_MIN_ALLOWED = 10;

export interface ScoreWeights {
  discount: number;
  nearLow: number;
  popularity: number;
  reliability: number;
  availability: number;
}
export const DEFAULT_WEIGHTS: ScoreWeights = {
  discount: 40,
  nearLow: 20,
  popularity: 15,
  reliability: 15,
  availability: 10,
};

export const HISTORY = {
  minDistinctDays: 5,
  minSpanDays: 14,
  fakePromoTolerance: 0.05,
  repeatPointHours: 6,
  expireAfterHours: 48,
} as const;

/**
 * Páginas do Pechinchou varridas (focadas em beleza e perfumaria), relativas a /categorias/.
 * "categoria" ou "categoria/sub/subcategoria"; só entram se existirem no sitemap do site.
 */
export const PECHINCHOU_PAGES = [
  "moda-beleza-e-perfumaria",
  "moda-beleza-e-perfumaria/sub/perfume-feminino",
  "moda-beleza-e-perfumaria/sub/maquiagens",
  "moda-beleza-e-perfumaria/sub/chapinha-secador-e-escova-secadora",
  "saude/sub/cuidados-pessoais",
  "supermercado/sub/produtos-de-higiene",
  // casa
  "cama-mesa-e-banho",
  "cama-mesa-e-banho/sub/banho",
  "cama-mesa-e-banho/sub/pecas-de-cama",
  "utilidades-domesticas",
  "utilidades-domesticas/sub/utilidades-variadas",
  "moveis-e-decoracao",
  "moveis-e-decoracao/sub/decoracao",
  "eletroportateis",
  "eletrodomesticos",
  "ar-e-ventilacao/sub/ventiladores-e-circuladores",
  "supermercado/sub/produtos-de-limpeza",
];
/** Categorias do Promobit (/promocoes/<slug>/) varridas; só a primeira página de cada uma é lida. */
export const PROMOBIT_CATEGORY_SLUGS: string[] = [
  "perfumes-e-beleza",
  "saude-e-higiene",
  // casa
  "casa-e-construcao",
  "cama-mesa-e-banho",
  "moveis-e-decoracao",
  "utensilios-domesticos",
  "eletroportateis",
];
