import type { MarketplaceId } from "./types";

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const MARKETPLACES: Record<MarketplaceId, { label: string; short: string }> = {
  amazon: { label: "Amazon", short: "AMZ" },
  mercadolivre: { label: "Mercado Livre", short: "ML" },
  shopee: { label: "Shopee", short: "SHP" },
};

export const discount = (price: number, old?: number) =>
  old && old > price ? Math.round((1 - price / old) * 100) : 0;
