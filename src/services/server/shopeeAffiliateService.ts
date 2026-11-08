import { createHash } from "node:crypto";
import { isShopeeShortLink } from "../../lib/vitrines";
import { parsePrice } from "../../robot/normalize";

/**
 * Cliente da API de afiliados da Shopee (Open API, GraphQL). Só lê dados de produto e devolve o link de
 * afiliado que a PRÓPRIA Shopee gera para a conta do dono do site; nada é montado à mão.
 *
 * ATENÇÃO: escrito a partir de fontes de terceiros (SDKs), sem a documentação oficial e sem credenciais.
 * Os nomes de campos, o formato da assinatura e o endereço precisam ser confirmados com um teste real
 * (botão "Testar conexão" no painel) antes de depender disto.
 */
const ENDPOINT =
  process.env["SHOPEE_API_URL"] || "https://open-api.affiliate.shopee.com.br/graphql";
const TIMEOUT_MS = 10_000;
const SHOPEE_HOST = /(^|\.)shopee\.com\.br$/;

export function credentials(): { appId: string; secret: string } | null {
  const appId = process.env["SHOPEE_APP_ID"];
  const secret = process.env["SHOPEE_APP_SECRET"];
  return appId && secret ? { appId, secret } : null;
}
export const isConfigured = () => credentials() !== null;

/** Cabeçalho Authorization: SHA256(AppId + Timestamp + Payload + Secret), em hexadecimal. */
export function signRequest(
  appId: string,
  secret: string,
  timestamp: number,
  payload: string,
): string {
  const signature = createHash("sha256")
    .update(`${appId}${timestamp}${payload}${secret}`)
    .digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

export class ShopeeApiError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

type FetchLike = typeof fetch;

async function graphql<T>(
  query: string,
  fetchImpl: FetchLike = fetch,
  now = () => Date.now(),
): Promise<T> {
  const creds = credentials();
  if (!creds) throw new ShopeeApiError("Configure SHOPEE_APP_ID e SHOPEE_APP_SECRET.", 503);
  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(now() / 1000);
  let res: Response;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: signRequest(creds.appId, creds.secret, timestamp, payload),
      },
      body: payload,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ShopeeApiError("Não foi possível falar com a API da Shopee.");
  }
  const body = (await res.json().catch(() => null)) as {
    data?: T;
    errors?: { message?: string; extensions?: { message?: string } }[];
  } | null;
  if (!res.ok || !body) throw new ShopeeApiError(`A API da Shopee respondeu HTTP ${res.status}.`);
  if (body.errors?.length) {
    const e = body.errors[0]!;
    throw new ShopeeApiError(
      `API da Shopee: ${e.extensions?.message ?? e.message ?? "erro desconhecido"}`,
      422,
    );
  }
  if (!body.data) throw new ShopeeApiError("Resposta vazia da API da Shopee.");
  return body.data;
}

/** Extrai shopId e itemId de uma URL de produto da Shopee. */
export function parseShopeeProductUrl(raw: string): { shopId: string; itemId: string } | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !SHOPEE_HOST.test(u.hostname.toLowerCase())) return null;
  // https://shopee.com.br/nome-do-produto-i.<shopId>.<itemId>
  const slug = u.pathname.match(/-i\.(\d{1,20})\.(\d{1,20})(?:\/|$)/);
  if (slug) return { shopId: slug[1]!, itemId: slug[2]! };
  // https://shopee.com.br/product/<shopId>/<itemId>
  const prod = u.pathname.match(/\/product\/(\d{1,20})\/(\d{1,20})(?:\/|$)/);
  if (prod) return { shopId: prod[1]!, itemId: prod[2]! };
  return null;
}

/** Segue um link curto da Shopee até a página do produto (só hosts da Shopee, até 6 saltos). */
export async function resolveShopeeShortLink(
  raw: string,
  fetchImpl: FetchLike = fetch,
): Promise<string | null> {
  if (!isShopeeShortLink(raw)) return null;
  let current = new URL(raw);
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetchImpl(current, {
      method: "HEAD",
      redirect: "manual",
      headers: { "user-agent": "MimaBot/1.0 (importação de link pelo painel)" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      const next = new URL(location, current);
      if (next.protocol !== "https:" || !SHOPEE_HOST.test(next.hostname.toLowerCase())) return null;
      current = next;
      continue;
    }
    return res.ok && SHOPEE_HOST.test(current.hostname.toLowerCase()) ? current.href : null;
  }
  return null;
}

export interface ShopeeProduct {
  title: string;
  /** preço atual no formato brasileiro, ex.: "59,90" */
  price: string;
  image_url: string;
  /** link de afiliado gerado pela Shopee para a conta do dono */
  affiliate_url: string;
  /** página do produto, usada depois para atualizar o preço */
  source_url: string;
}

interface OfferNode {
  productName?: string;
  price?: string | number;
  priceMin?: string | number;
  imageUrl?: string;
  productLink?: string;
  offerLink?: string;
}

const toBr = (v: unknown): string => {
  const n = parsePrice(typeof v === "number" ? v : String(v ?? ""));
  return n && n > 0 ? n.toFixed(2).replace(".", ",") : "";
};

export async function fetchShopeeProduct(
  ids: { shopId: string; itemId: string },
  fetchImpl: FetchLike = fetch,
): Promise<ShopeeProduct> {
  // ids são só dígitos (validados em parseShopeeProductUrl): seguro interpolar na consulta
  const q = `{ productOfferV2(shopId: ${ids.shopId}, itemId: ${ids.itemId}, limit: 1) { nodes { productName price priceMin imageUrl productLink offerLink } } }`;
  const data = await graphql<{ productOfferV2?: { nodes?: OfferNode[] } }>(q, fetchImpl);
  const node = data.productOfferV2?.nodes?.[0];
  if (!node) throw new ShopeeApiError("Produto não encontrado na API de afiliados da Shopee.", 404);
  const title = node.productName?.trim();
  const price = toBr(node.priceMin ?? node.price);
  const affiliate =
    node.offerLink?.trim() || (await generateShortLink(node.productLink ?? "", fetchImpl));
  if (!title || !affiliate)
    throw new ShopeeApiError("A API não devolveu título ou link de afiliado.");
  return {
    title,
    price,
    image_url: node.imageUrl?.startsWith("https://") ? node.imageUrl : "",
    affiliate_url: affiliate,
    source_url: node.productLink?.startsWith("https://")
      ? node.productLink
      : `https://shopee.com.br/product/${ids.shopId}/${ids.itemId}`,
  };
}

/** Pede à Shopee o link curto de afiliado de uma página de produto. */
export async function generateShortLink(
  originUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<string | null> {
  if (!originUrl.startsWith("https://")) return null;
  const q = `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(originUrl)}, subIds: ["mima"] }) { shortLink } }`;
  const data = await graphql<{ generateShortLink?: { shortLink?: string } }>(q, fetchImpl);
  return data.generateShortLink?.shortLink ?? null;
}

/** A partir de um link da Shopee (página do produto ou link curto), busca o produto na API de afiliados. */
export async function importFromShopeeUrl(
  raw: string,
  fetchImpl: FetchLike = fetch,
): Promise<ShopeeProduct> {
  let url = raw.trim();
  if (isShopeeShortLink(url)) {
    const resolved = await resolveShopeeShortLink(url, fetchImpl);
    if (!resolved) throw new ShopeeApiError("Não consegui abrir esse link curto da Shopee.", 422);
    url = resolved;
  }
  const ids = parseShopeeProductUrl(url);
  if (!ids) throw new ShopeeApiError("Esse não parece um link de produto da Shopee.", 422);
  return fetchShopeeProduct(ids, fetchImpl);
}
