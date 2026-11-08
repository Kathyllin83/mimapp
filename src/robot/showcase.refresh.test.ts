// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let dbUp = false;
try {
  const { dbQuery } = await import("../lib/server/db");
  await dbQuery("SELECT source_url FROM robot_showcase_items LIMIT 1");
  dbUp = true;
} catch {
  dbUp = false;
}

describe.skipIf(!dbUp)("atualização de preços da Shopee (Postgres + API simulada)", () => {
  const TITLE = "__teste_refresh__";
  const cleanup = async () => {
    const { dbQuery } = await import("../lib/server/db");
    await dbQuery("DELETE FROM robot_showcase_items WHERE title LIKE $1", [`${TITLE}%`]);
  };
  beforeAll(async () => {
    vi.stubEnv("SHOPEE_APP_ID", "app");
    vi.stubEnv("SHOPEE_APP_SECRET", "seg");
    await cleanup();
  });
  afterEach(cleanup);
  afterAll(() => vi.unstubAllEnvs());

  const api = (nodes: unknown[]) =>
    vi.fn(async () => new Response(JSON.stringify({ data: { productOfferV2: { nodes } } })));

  async function seed(over: Record<string, unknown> = {}) {
    const { createShowcaseItem, validateShowcaseInput } = await import("./showcase");
    const v = validateShowcaseInput({
      store: "shopee",
      title: `${TITLE} a`,
      price: "100,00",
      old_price: "150,00",
      affiliate_url: "https://s.shopee.com.br/abc",
      source_url: "https://shopee.com.br/product/11/22",
      ...over,
    });
    if (!v.ok) throw new Error(v.error);
    return createShowcaseItem(v.value);
  }

  it("atualiza o preço, apaga o preço anterior que deixou de fazer sentido e renova a data", async () => {
    const { refreshShopeePrices, listShowcase } = await import("./showcase");
    const id = await seed();
    const fetchImpl = api([
      {
        productName: "X",
        priceMin: "80.00",
        offerLink: "https://s.shopee.com.br/abc",
        productLink: "https://shopee.com.br/product/11/22",
      },
    ]);
    const r = await refreshShopeePrices({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      pauseMs: 0,
    });
    expect(r.failed).toEqual([]);
    expect(r.checked).toBeGreaterThanOrEqual(1);
    const item = (await listShowcase("shopee")).find((i) => i.id === id)!;
    expect(item.price).toBe(80);
    expect(item.old_price).toBe(150); // ainda maior que o novo preço: mantém
  });

  it("zera o preço anterior quando o novo preço o alcança", async () => {
    const { refreshShopeePrices, listShowcase } = await import("./showcase");
    const id = await seed();
    const f = api([
      { productName: "X", priceMin: "160.00", offerLink: "https://s.shopee.com.br/abc" },
    ]);
    await refreshShopeePrices({ fetchImpl: f as unknown as typeof fetch, pauseMs: 0 });
    const item = (await listShowcase("shopee")).find((i) => i.id === id)!;
    expect(item.price).toBe(160);
    expect(item.old_price).toBeNull();
  });

  it("não mexe no produto quando a API falha e ignora itens sem página de origem", async () => {
    const { refreshShopeePrices, listShowcase } = await import("./showcase");
    const id = await seed();
    const noSource = await seed({ title: `${TITLE} b`, source_url: "" });
    const f = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ errors: [{ message: "x", extensions: { message: "rate limit" } }] }),
        ),
    );
    const r = await refreshShopeePrices({ fetchImpl: f as unknown as typeof fetch, pauseMs: 0 });
    expect(r.failed.some((x) => x.id === id && /rate limit/.test(x.error))).toBe(true);
    const items = await listShowcase("shopee");
    expect(items.find((i) => i.id === id)!.price).toBe(100);
    expect(r.failed.some((x) => x.id === noSource)).toBe(false);
  });
});
