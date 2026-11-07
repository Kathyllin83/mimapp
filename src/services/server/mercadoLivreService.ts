import type { Offer } from "@/lib/types";
import type { MarketplaceService } from "../contracts";

const API_ROOT = "https://api.mercadolibre.com";
const SITE = process.env["ML_SITE_ID"] || "MLB";
const TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 10 * 60_000;

export type MarketplaceListing = Offer & { title: string };

let token: { value: string; expiresAt: number } | undefined;
const searchCache = new Map<string, { at: number; listings: MarketplaceListing[] }>();

function credentials() {
  const id = process.env["ML_CLIENT_ID"];
  const secret = process.env["ML_CLIENT_SECRET"];
  return id && secret ? { id, secret } : null;
}

async function accessToken(): Promise<string | null> {
  const creds = credentials();
  if (!creds) return null;
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const response = await fetch(`${API_ROOT}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.id,
      client_secret: creds.secret,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`ml_token_${response.status}`);
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("ml_token_empty");
  token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return token.value;
}

type MlItem = {
  id?: string;
  title?: string;
  price?: number;
  currency_id?: string;
  permalink?: string;
  shipping?: { free_shipping?: boolean };
};

function toListing(item: MlItem, fetchedAt: string): MarketplaceListing | null {
  if (!item.id || !item.title || typeof item.price !== "number" || !item.permalink) return null;
  if (item.currency_id && item.currency_id !== "BRL") return null;
  return {
    productId: item.id,
    marketplace: "mercadolivre",
    title: item.title,
    price: item.price,
    shipping: item.shipping?.free_shipping ? 0 : null,
    originalUrl: item.permalink,
    // Afiliado só é preenchido quando houver programa configurado (ver affiliateService).
    affiliateUrl: null,
    isDemo: false,
    fetchedAt,
  };
}

export const mercadoLivreServer = {
  id: "mercadolivre" as const,
  get enabled() {
    return credentials() !== null;
  },
  async search(query: string): Promise<MarketplaceListing[]> {
    const q = query.trim().slice(0, 100);
    if (!q) return [];
    const cacheKey = q.toLowerCase();
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.listings;
    try {
      const bearer = await accessToken();
      if (!bearer) return [];
      const url = `${API_ROOT}/sites/${SITE}/search?${new URLSearchParams({ q, limit: "10" })}`;
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${bearer}`, accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`ml_search_${response.status}`);
      const data = (await response.json()) as { results?: MlItem[] };
      const fetchedAt = new Date().toISOString();
      const listings = (data.results ?? []).flatMap((item) => {
        const listing = toListing(item, fetchedAt);
        return listing ? [listing] : [];
      });
      searchCache.set(cacheKey, { at: Date.now(), listings });
      return listings;
    } catch (error) {
      // Falha do marketplace nunca derruba a assistente: ela responde sem preços.
      console.error("ml_search_failed", error instanceof Error ? error.message : "unknown");
      return [];
    }
  },
  async getOffer(productId: string): Promise<MarketplaceListing | null> {
    try {
      const bearer = await accessToken();
      if (!bearer) return null;
      const response = await fetch(`${API_ROOT}/items/${encodeURIComponent(productId)}`, {
        headers: { authorization: `Bearer ${bearer}`, accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) return null;
      return toListing((await response.json()) as MlItem, new Date().toISOString());
    } catch {
      return null;
    }
  },
};

// Verificação de conformidade com o contrato comum.
mercadoLivreServer satisfies MarketplaceService;
