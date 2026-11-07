import { describe, expect, it } from "vitest";
import { parsePromobit } from "./connectors/promobit";
import { parsePechinchou, subcategoryUrlsFromSitemap } from "./connectors/pechinchou";
import {
  cleanProductUrl,
  dedupeKey,
  isAllowedAffiliateDomain,
  sanitizeOldPrice,
} from "./normalize";
import { analyze, shouldRecordPoint, type PricePoint } from "./pricing";
import { classifyTopics } from "./topics";
import { DEFAULT_WEIGHTS } from "./config";
import { StructureChangedError } from "./types";

const page = (pageProps: unknown) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps } })}</script></html>`;

describe("conector Promobit", () => {
  const offer = {
    offerId: 1,
    offerTitle: "Perfume Feminino X 100ml",
    offerSlug: "perfume-x-1",
    offerPrice: 99.9,
    offerOldPrice: 0.01,
    offerPriceType: "NORMAL",
    offerStatusName: "Ativa",
    storeDomain: "amazon.com.br",
    storeParam: "amazon",
    storeName: "Amazon",
    offerPhoto: "/offer/1.jpg",
    offerEngagementScore: 40,
  };
  it("lê ofertas, prefixa imagem, descarta preço riscado sentinela e não guarda URL de loja", () => {
    const [o] = parsePromobit(
      page({ serverOffers: { offers: [offer] }, category: { categoryName: "Beleza" } }),
    );
    expect(o).toMatchObject({
      externalId: "1",
      marketplace: "amazon",
      price: 99.9,
      oldPrice: null,
      category: "Beleza",
      imageUrl: "https://i.promobit.com.br/offer/1.jpg",
      sourceUrl: "https://www.promobit.com.br/oferta/perfume-x-1",
      cleanUrl: null,
    });
  });
  it("ignora lojas fora das 4 e tipos de preço não NORMAL", () => {
    const rows = [
      {
        ...offer,
        offerId: 2,
        storeDomain: "magazineluiza.com.br",
        storeParam: "magalu",
        storeName: "Magalu",
      },
      { ...offer, offerId: 3, offerPriceType: "COUPON" },
    ];
    expect(parsePromobit(page({ serverOffers: { offers: rows } }))).toEqual([]);
  });
  it("detecta mudança de estrutura", () => {
    expect(() => parsePromobit(page({ outra: 1 }))).toThrow(StructureChangedError);
    expect(() => parsePromobit("<html></html>")).toThrow(StructureChangedError);
    expect(() => parsePromobit(page({ serverOffers: { offers: [{ foo: 1 }] } }))).toThrow(
      StructureChangedError,
    );
  });
});

describe("conector Pechinchou", () => {
  const promo = {
    id: 10,
    title: "Batom Matte",
    slug: "batom-10",
    price: "29.90",
    old_price: "49.90",
    status: "ACTIVE",
    image: "https://img.test/b.jpg",
    store: { slug: "mercado-livre", name: "Mercado Livre", slug_url: "mercado-livre" },
    subcategory: {
      slug: "maquiagens",
      name: "Maquiagens",
      category: { name: "Moda, Beleza e Perfumaria" },
    },
    tot_likes_and_dislikes: 10,
    total_comment: 2,
    count_of_views: 500,
    long_url: "https://www.amazon.com.br/dp/B012345678?tag=parceiropechi-20&ref=x",
    short_url: "https://meli.la/abc",
  };
  it("converte strings, marca expirada e nunca expõe tag de afiliado", () => {
    const [o, c] = parsePechinchou(
      page({
        promos: { results: [promo, { ...promo, id: 11, status: "CLOSED", long_url: null }] },
      }),
    );
    expect(o).toMatchObject({
      price: 29.9,
      oldPrice: 49.9,
      marketplace: "mercado-livre",
      subcategory: "maquiagens",
      status: "active",
    });
    expect(o!.cleanUrl).toBe("https://www.amazon.com.br/dp/B012345678");
    expect(JSON.stringify(o)).not.toMatch(/tag=|parceiropechi|meli\.la/);
    expect(c!.status).toBe("closed");
  });
  it("lê páginas de loja (products.results) e detecta mudança de estrutura", () => {
    expect(parsePechinchou(page({ products: { results: [promo] } }))).toHaveLength(1);
    expect(() => parsePechinchou(page({ x: 1 }))).toThrow(StructureChangedError);
  });
  it("filtra subcategorias do sitemap", () => {
    const xml = `<urlset><url><loc>https://www.pechinchou.com.br/categorias/moda-beleza-e-perfumaria/sub/maquiagens</loc></url><url><loc>https://www.pechinchou.com.br/categorias/games/sub/x</loc></url></urlset>`;
    expect(
      subcategoryUrlsFromSitemap(xml, ["moda-beleza-e-perfumaria/sub/maquiagens"]),
    ).toHaveLength(1);
  });
});

describe("normalização", () => {
  it("preço riscado sentinela ou <= preço é descartado", () => {
    expect(sanitizeOldPrice(10, 0.01)).toBeNull();
    expect(sanitizeOldPrice(10, 10)).toBeNull();
    expect(sanitizeOldPrice(10, 15)).toBe(15);
  });
  it("limpa URLs: só Amazon /dp e produto do ML; remove query", () => {
    expect(cleanProductUrl("https://www.amazon.com.br/Nome/dp/B012345678/ref=x?tag=abc")).toBe(
      "https://www.amazon.com.br/dp/B012345678",
    );
    expect(cleanProductUrl("https://meli.la/abc")).toBeNull();
    expect(cleanProductUrl("https://www.amazon.com.br/s?k=perfume")).toBeNull();
    expect(cleanProductUrl("https://www.mercadolivre.com.br/produto/p/MLB123456?x=1")).toBe(
      "https://www.mercadolivre.com.br/produto/p/MLB123456",
    );
    expect(cleanProductUrl("https://shopee.com.br/x")).toBeNull();
  });
  it("dedupe: título normalizado sem acento e ordem das palavras", () => {
    expect(dedupeKey("Perfume Feminino Água", "amazon")).toBe(
      dedupeKey("agua  feminino PERFUME!", "amazon"),
    );
    expect(dedupeKey("a", "amazon")).not.toBe(dedupeKey("a", "shopee"));
  });
  it("valida só o domínio do link de afiliado", () => {
    expect(isAllowedAffiliateDomain("https://amzn.to/3abc")).toBe(true);
    expect(isAllowedAffiliateDomain("https://meli.la/abc")).toBe(true);
    expect(isAllowedAffiliateDomain("https://s.click.aliexpress.com/e/_x")).toBe(true);
    expect(isAllowedAffiliateDomain("https://evil.com/amzn.to")).toBe(false);
    expect(isAllowedAffiliateDomain("http://amzn.to/x")).toBe(false);
  });
});

describe("tópicos", () => {
  const t = (title: string, subcategory?: string, category?: string) =>
    classifyTopics({ title, subcategory: subcategory ?? null, category: category ?? null });
  it("acertos", () => {
    expect(t("Chapinha Profissional Bivolt")).toContain("cabelos");
    expect(t("Shampoo Anti-Frizz 300ml")).toContain("cabelos");
    expect(t("Qualquer coisa", "chapinha-secador-e-escova-secadora")).toContain("cabelos");
    expect(t("Batom Líquido Matte")).toContain("maquiagem");
    expect(t("Base Líquida HD")).toContain("maquiagem");
    expect(t("Perfume Feminino Floral EDP 100ml")).toContain("perfume-feminino");
    expect(t("Body Splash Hello For Women")).toContain("perfume-feminino");
    // título sem indicador feminino, mas a fonte classifica como perfume feminino
    expect(t("Perfume Voyage Intense Eau De Toilette 100ml", "perfume-feminino")).toContain(
      "perfume-feminino",
    );
    expect(t("Deo Colônia Nah Hello 100ml", "perfume-feminino")).toContain("perfume-feminino");
  });
  it("exclusões", () => {
    expect(t("Secador de Roupa Dobrável")).toEqual([]);
    expect(t("Perfume Masculino Amadeirado")).not.toContain("perfume-feminino");
    expect(t("Perfume Importado 100ml")).toEqual([]);
    expect(t("Perfume Masculino Hugo Boss", "perfume-feminino")).not.toContain("perfume-feminino");
    expect(t("Eau de Toilette Calvin Klein Ck One", "perfume-masculino")).toEqual([]);
    expect(t("Câmera com sombra e blush de brinquedo infantil")).not.toContain("maquiagem");
  });
  it("skincare: pele e rosto", () => {
    expect(t("Protetor Solar Facial FPS 60 40g")).toContain("skincare");
    expect(t("Sérum Vitamina C 30ml")).toContain("skincare");
    expect(t("Hidratante Corporal Nivea 400ml")).toContain("skincare");
    expect(t("Água Micelar Bioré 300ml")).toContain("skincare");
    expect(t("Máscara Hidratante Capilar 500g")).not.toContain("skincare");
    expect(t("Dove Desodorante Antitranspirante em Creme Sérum 50g")).not.toContain("skincare");
    expect(t("Shampoo e Condicionador Hidratante")).not.toContain("skincare");
  });
  it("casa: por categoria da fonte, subcategoria ou palavra", () => {
    expect(t("Conjunto Facas Inox", undefined, "Utilidades Domésticas")).toContain("casa");
    expect(t("Jogo de Lençol Queen 400 fios", undefined, "Cama, Mesa e Banho")).toContain("casa");
    expect(t("Qualquer produto", undefined, "Móveis e Decoração")).toContain("casa");
    expect(t("Desinfetante 2L", "produtos-de-limpeza")).toContain("casa");
    expect(t("Fritadeira Elétrica Air Fryer 4L")).toContain("casa");
    expect(t("Perfume Feminino Floral", undefined, "Utilidades Domésticas")).not.toContain("casa");
    expect(t("Smartphone 128GB", undefined, "Telefonia")).not.toContain("casa");
  });
  it("palavra inteira", () => {
    expect(t("Fogão com brush")).toEqual([]);
  });
});

const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n, 12));
const hist = (prices: number[], spacing = 3): PricePoint[] =>
  prices.map((price, i) => ({ price, recordedAt: day(i * spacing) }));
const base = { status: "active" as const, popularity: 50 };

describe("histórico e nota", () => {
  it("sem histórico: desconto não validado, só 'preço informado pela loja'", () => {
    const r = analyze({ ...base, price: 60, oldPrice: 100, history: hist([60], 1) });
    expect(r.discountValidated).toBe(false);
    expect(r.flags).toContain("discount_unvalidated");
    expect(r.discountPct).toBe(40);
  });
  it("exige >= 5 dias distintos em >= 14 dias", () => {
    expect(
      analyze({ ...base, price: 60, oldPrice: 100, history: hist([100, 100, 100, 100, 60], 1) })
        .discountValidated,
    ).toBe(false); // 4 dias de span
    expect(
      analyze({ ...base, price: 60, oldPrice: 100, history: hist([100, 100, 60], 10) })
        .discountValidated,
    ).toBe(false); // só 3 dias
    expect(
      analyze({ ...base, price: 60, oldPrice: 100, history: hist([100, 100, 100, 100, 60], 4) })
        .discountValidated,
    ).toBe(true);
  });
  it("desconto validado usa a mediana do histórico", () => {
    const r = analyze({
      ...base,
      price: 60,
      oldPrice: 100,
      history: hist([100, 100, 100, 100, 60], 4),
    });
    expect(r.discountValidated).toBe(true);
    expect(r.discountPct).toBe(40);
    expect(r.flags).not.toContain("discount_unvalidated");
  });
  it("falsa promoção: mediana ~ preço atual mas a fonte alega desconto", () => {
    const r = analyze({
      ...base,
      price: 100,
      oldPrice: 200,
      history: hist([100, 102, 100, 98, 100], 4),
    });
    expect(r.flags).toContain("possible_fake_promotion");
    expect(r.discountPct ?? 0).toBeLessThan(5);
    const honest = analyze({
      ...base,
      price: 100,
      oldPrice: null,
      history: hist([100, 102, 100, 98, 100], 4),
    });
    expect(r.score).toBeLessThanOrEqual(honest.score + 0);
  });
  it("desconto não validado vale 40% do componente", () => {
    const w = { discount: 100, nearLow: 0, popularity: 0, reliability: 0, availability: 0 };
    const r = analyze({ ...base, price: 50, oldPrice: 100, history: [] }, w);
    expect(r.score).toBe(40); // 50% de desconto => componente cheio * 0.4
  });
  it("pesos são configuráveis e indisponível tem teto 20", () => {
    const only = { discount: 0, nearLow: 0, popularity: 100, reliability: 0, availability: 0 };
    expect(
      analyze({ ...base, popularity: 80, price: 10, oldPrice: null, history: [] }, only).score,
    ).toBe(80);
    const closed = analyze({
      ...base,
      status: "closed",
      price: 50,
      oldPrice: 100,
      history: hist([100, 100, 100, 100, 50], 4),
    });
    expect(closed.score).toBeLessThanOrEqual(20);
    expect(DEFAULT_WEIGHTS.discount).toBe(40);
  });
  it("ponto de preço: só quando muda ou passam 6 h", () => {
    const last = { price: 10, recordedAt: new Date("2026-11-01T10:00:00Z") };
    expect(shouldRecordPoint(undefined, 10, new Date())).toBe(true);
    expect(shouldRecordPoint(last, 10, new Date("2026-11-01T12:00:00Z"))).toBe(false);
    expect(shouldRecordPoint(last, 9, new Date("2026-11-01T10:05:00Z"))).toBe(true);
    expect(shouldRecordPoint(last, 10, new Date("2026-11-01T16:00:00Z"))).toBe(true);
  });
});
