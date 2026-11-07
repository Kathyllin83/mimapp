import { describe, expect, it } from "vitest";
import { toPublicOffer, validateShowcaseInput, type ShowcaseItem } from "./showcase";

const ok = {
  store: "amazon",
  title: "Perfume Teste Feminino 100ml",
  image_url: "https://m.media-amazon.com/images/I/x.jpg",
  price: "89,90",
  old_price: "129,90",
  affiliate_url: "https://amzn.to/3abc",
};

describe("produto da vitrine", () => {
  it("aceita preço em formato brasileiro e link da mesma loja", () => {
    const v = validateShowcaseInput(ok);
    expect(v).toMatchObject({ ok: true, value: { price: 89.9, old_price: 129.9 } });
  });
  it("rejeita link de outra loja, de domínio estranho e sem https", () => {
    expect(validateShowcaseInput({ ...ok, affiliate_url: "https://shope.ee/x" }).ok).toBe(false);
    expect(validateShowcaseInput({ ...ok, affiliate_url: "https://evil.com/x" }).ok).toBe(false);
    expect(validateShowcaseInput({ ...ok, affiliate_url: "http://amzn.to/x" }).ok).toBe(false);
    expect(validateShowcaseInput({ ...ok, affiliate_url: "" }).ok).toBe(false);
  });
  it("valida preço, preço anterior, título, imagem e loja", () => {
    expect(validateShowcaseInput({ ...ok, price: "0" }).ok).toBe(false);
    expect(validateShowcaseInput({ ...ok, price: "abc" }).ok).toBe(false);
    expect(validateShowcaseInput({ ...ok, old_price: "50" }).ok).toBe(false);
    expect(validateShowcaseInput({ ...ok, title: "ab" }).ok).toBe(false);
    expect(validateShowcaseInput({ ...ok, image_url: "http://x.com/a.jpg" }).ok).toBe(false);
    expect(validateShowcaseInput({ ...ok, store: "aliexpress" }).ok).toBe(false);
    expect(validateShowcaseInput({ ...ok, old_price: "", image_url: "" }).ok).toBe(true);
  });
  it("no formato público o desconto nunca é validado e o botão usa só o link cadastrado", () => {
    const item: ShowcaseItem = {
      id: 5,
      store: "amazon",
      title: "X",
      image_url: null,
      price: 50,
      old_price: 100,
      affiliate_url: "https://amzn.to/3abc",
      position: 0,
      updated_at: "2026-11-07T10:00:00.000Z",
    };
    const o = toPublicOffer(item);
    expect(o.discount_validated).toBe(false);
    expect(o.discount_pct).toBe(50);
    expect(o.buy_url).toBe("https://amzn.to/3abc");
    expect(o.id).toBeGreaterThan(1_000_000_000);
  });
});
