import { brl } from "./format";

/** Item devolvido por /api/offers (robô de ofertas). */
export interface ApiOffer {
  id: number;
  title: string;
  image_url: string | null;
  marketplace: string;
  category: string | null;
  topics: string[];
  price: number;
  currency: string;
  old_price: number | null;
  discount_pct: number | null;
  discount_validated: boolean;
  score: number;
  flags: string[];
  buy_url: string | null;
  buy_url_is_affiliate: boolean;
  updated_at: string;
}

export interface ApiOffersPage {
  data: ApiOffer[];
  current_page: number;
  last_page: number;
  total: number;
  freshness: { last_success_at: string | null; stalled: boolean };
}

export const OFFER_STORES = [
  { slug: "amazon", label: "Amazon" },
  { slug: "mercado-livre", label: "Mercado Livre" },
  { slug: "shopee", label: "Shopee" },
  { slug: "aliexpress", label: "AliExpress" },
] as const;

export const storeLabel = (slug: string) =>
  OFFER_STORES.find((s) => s.slug === slug)?.label ?? slug;

export type DiscountLabel =
  { kind: "validated"; badge: string } | { kind: "informed"; text: string } | null;

/**
 * Regra do desconto: só destaca "-X%" quando confirmado por histórico próprio.
 * Caso contrário, apenas informa o preço riscado como "preço informado pela loja".
 */
export function discountLabel(o: ApiOffer): DiscountLabel {
  if (
    o.discount_validated &&
    !o.flags.includes("possible_fake_promotion") &&
    o.discount_pct !== null &&
    o.discount_pct > 0
  ) {
    return { kind: "validated", badge: `−${Math.round(o.discount_pct)}%` };
  }
  if (o.old_price !== null && o.old_price > o.price) {
    return {
      kind: "informed",
      text: `de ${brl(o.old_price)} por ${brl(o.price)}, preço informado pela loja`,
    };
  }
  return null;
}

/** Botão de compra: SOMENTE `buy_url`. Nunca monta nem altera a URL. */
export function buyHref(o: ApiOffer): string | null {
  return o.buy_url && /^https?:\/\//i.test(o.buy_url) ? o.buy_url : null;
}

export function formatUpdated(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
