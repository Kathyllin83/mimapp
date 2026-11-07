import { describe, expect, it } from "vitest";
import { buyHref, discountLabel, type ApiOffer } from "./offers";

const offer = (over: Partial<ApiOffer> = {}): ApiOffer => ({
  id: 1,
  title: "Body Splash",
  image_url: null,
  marketplace: "mercado-livre",
  category: null,
  topics: [],
  price: 34.71,
  currency: "BRL",
  old_price: 49.9,
  discount_pct: 30.44,
  discount_validated: false,
  score: 20,
  flags: ["discount_unvalidated"],
  buy_url: null,
  buy_url_is_affiliate: false,
  updated_at: "2026-11-07T19:50:51+00:00",
  ...over,
});

describe("regra do desconto", () => {
  it("não validado: nunca vira selo de percentual, só 'preço informado pela loja'", () => {
    const l = discountLabel(offer());
    expect(l?.kind).toBe("informed");
    expect(JSON.stringify(l)).toContain("preço informado pela loja");
    expect(JSON.stringify(l)).not.toMatch(/%/);
  });
  it("validado: destaca o percentual", () => {
    expect(discountLabel(offer({ discount_validated: true, flags: [] }))).toEqual({
      kind: "validated",
      badge: "−30%",
    });
  });
  it("possível falsa promoção nunca destaca percentual", () => {
    const l = discountLabel(
      offer({ discount_validated: true, flags: ["possible_fake_promotion"] }),
    );
    expect(l?.kind).not.toBe("validated");
  });
  it("sem preço riscado e sem validação: nada", () => {
    expect(discountLabel(offer({ old_price: null }))).toBeNull();
  });
});

describe("botão de compra", () => {
  it("buy_url nulo: sem botão", () => {
    expect(buyHref(offer())).toBeNull();
  });
  it("usa exatamente o buy_url, sem alterar", () => {
    const url = "https://amzn.to/3abc?x=1";
    expect(buyHref(offer({ buy_url: url }))).toBe(url);
  });
  it("rejeita esquemas inseguros", () => {
    expect(buyHref(offer({ buy_url: "javascript:alert(1)" }))).toBeNull();
  });
});
