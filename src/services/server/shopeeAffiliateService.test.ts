// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ShopeeApiError,
  fetchShopeeProduct,
  importFromShopeeUrl,
  parseShopeeProductUrl,
  signRequest,
} from "./shopeeAffiliateService";

describe("assinatura da requisição", () => {
  it("é o SHA256 de AppId + Timestamp + Payload + Secret", () => {
    const sig = createHash("sha256")
      .update("123" + 1700000000 + '{"query":"{a}"}' + "segredo")
      .digest("hex");
    expect(signRequest("123", "segredo", 1700000000, '{"query":"{a}"}')).toBe(
      `SHA256 Credential=123, Timestamp=1700000000, Signature=${sig}`,
    );
  });
});

describe("URL de produto da Shopee", () => {
  it("extrai shopId e itemId dos dois formatos", () => {
    expect(
      parseShopeeProductUrl("https://shopee.com.br/Fone-Bluetooth-i.123456.7891011?sp_atk=x"),
    ).toEqual({
      shopId: "123456",
      itemId: "7891011",
    });
    expect(parseShopeeProductUrl("https://shopee.com.br/product/123456/7891011")).toEqual({
      shopId: "123456",
      itemId: "7891011",
    });
  });
  it("recusa outros sites, http e páginas que não são de produto", () => {
    expect(parseShopeeProductUrl("https://evil.com/x-i.1.2")).toBeNull();
    expect(parseShopeeProductUrl("http://shopee.com.br/x-i.1.2")).toBeNull();
    expect(parseShopeeProductUrl("https://shopee.com.br/search?keyword=a")).toBeNull();
    expect(parseShopeeProductUrl("nada")).toBeNull();
  });
});

describe("busca do produto pela API", () => {
  beforeEach(() => {
    vi.stubEnv("SHOPEE_APP_ID", "app1");
    vi.stubEnv("SHOPEE_APP_SECRET", "seg1");
  });
  afterEach(() => vi.unstubAllEnvs());

  const reply = (body: unknown, status = 200) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("devolve título, preço em formato brasileiro, imagem e o link de afiliado da própria Shopee", async () => {
    const fetchMock = reply({
      data: {
        productOfferV2: {
          nodes: [
            {
              productName: "Fone Bluetooth",
              priceMin: "59.9",
              imageUrl: "https://cf.shopee.com.br/file/a",
              productLink: "https://shopee.com.br/product/1/2",
              offerLink: "https://s.shopee.com.br/AbCd",
            },
          ],
        },
      },
    });
    const p = await fetchShopeeProduct(
      { shopId: "1", itemId: "2" },
      fetchMock as unknown as typeof fetch,
    );
    expect(p).toEqual({
      title: "Fone Bluetooth",
      price: "59,90",
      image_url: "https://cf.shopee.com.br/file/a",
      affiliate_url: "https://s.shopee.com.br/AbCd",
      source_url: "https://shopee.com.br/product/1/2",
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String((init.headers as Record<string, string>)["authorization"])).toMatch(
      /^SHA256 Credential=app1, Timestamp=\d+, Signature=[0-9a-f]{64}$/,
    );
    expect(String(init.body)).toContain("productOfferV2(shopId: 1, itemId: 2");
  });

  it("traduz erros da API e produto inexistente", async () => {
    const e1 = reply({ errors: [{ message: "x", extensions: { message: "Invalid Signature" } }] });
    await expect(
      fetchShopeeProduct({ shopId: "1", itemId: "2" }, e1 as unknown as typeof fetch),
    ).rejects.toThrow(/Invalid Signature/);
    const e2 = reply({ data: { productOfferV2: { nodes: [] } } });
    await expect(
      fetchShopeeProduct({ shopId: "1", itemId: "2" }, e2 as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(ShopeeApiError);
  });

  it("sem credenciais configuradas, pede a configuração e não faz requisição", async () => {
    vi.stubEnv("SHOPEE_APP_ID", "");
    const f = reply({});
    await expect(
      importFromShopeeUrl("https://shopee.com.br/product/1/2", f as unknown as typeof fetch),
    ).rejects.toThrow(/SHOPEE_APP_ID/);
    expect(f).not.toHaveBeenCalled();
  });

  it("recusa links que não são da Shopee antes de chamar a API", async () => {
    const f = reply({});
    await expect(
      importFromShopeeUrl("https://amazon.com.br/dp/B083JL2JKF", f as unknown as typeof fetch),
    ).rejects.toThrow(/link de produto da Shopee/);
    expect(f).not.toHaveBeenCalled();
  });
});
