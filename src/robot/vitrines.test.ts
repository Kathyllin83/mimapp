import { describe, expect, it } from "vitest";
import { isEmbeddable, isVitrineStore, validateVitrine } from "./vitrines";

describe("vitrines", () => {
  it("só amazon, mercado-livre e shopee têm vitrine", () => {
    expect(isVitrineStore("amazon")).toBe(true);
    expect(isVitrineStore("mercado-livre")).toBe(true);
    expect(isVitrineStore("shopee")).toBe(true);
    expect(isVitrineStore("aliexpress")).toBe(false);
    expect(isVitrineStore("all")).toBe(false);
  });
  it("aceita só https e normaliza título e altura", () => {
    expect(validateVitrine({ url: " https://meusite.com/vitrine " })).toMatchObject({
      ok: true,
      url: "https://meusite.com/vitrine",
      title: null,
      height: 900,
    });
    expect(
      validateVitrine({ url: "https://a.com", title: "  Minha  ", height: "1200" }),
    ).toMatchObject({ title: "Minha", height: 1200 });
  });
  it("rejeita http, javascript:, lixo e altura fora do limite", () => {
    for (const url of ["http://a.com", "javascript:alert(1)", "data:text/html,x", "nada", ""]) {
      expect(validateVitrine({ url }).ok).toBe(false);
    }
    expect(validateVitrine({ url: "https://a.com", height: 50 }).ok).toBe(false);
    expect(validateVitrine({ url: "https://a.com", height: 9999 }).ok).toBe(false);
  });
});

describe("vitrine embutida x link", () => {
  it("links das lojas não podem ser embutidos (abrem em nova aba)", () => {
    expect(isEmbeddable("https://www.amazon.com.br/shop/x/list/1?tag=a-20")).toBe(false);
    expect(isEmbeddable("https://amzn.to/abc")).toBe(false);
    expect(isEmbeddable("https://www.mercadolivre.com.br/social/x")).toBe(false);
    expect(isEmbeddable("https://shopee.com.br/x")).toBe(false);
  });
  it("página própria pode ser embutida", () => {
    expect(isEmbeddable("https://meusite.com/vitrine/amazon")).toBe(true);
  });
});
