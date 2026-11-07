import { describe, expect, it } from "vitest";
import { amazonAffiliateUrl, isValidAmazonTag } from "./normalize";

describe("código de associado da Amazon", () => {
  it("valida o formato do código", () => {
    expect(isValidAmazonTag("dleysson-20")).toBe(true);
    expect(isValidAmazonTag("  meu-site-21 ")).toBe(true);
    for (const bad of [
      "",
      "dleysson",
      "dleysson-2",
      "-20",
      "a b-20",
      "x&y=1-20",
      "dleysson-20&foo=1",
    ]) {
      expect(isValidAmazonTag(bad)).toBe(false);
    }
  });
  it("monta o link só com o formato simples ?tag=", () => {
    expect(amazonAffiliateUrl("https://www.amazon.com.br/dp/B083JL2JKF", "dleysson-20")).toBe(
      "https://www.amazon.com.br/dp/B083JL2JKF?tag=dleysson-20",
    );
  });
  it("não monta sem código, com código inválido ou fora da URL limpa da Amazon", () => {
    const url = "https://www.amazon.com.br/dp/B083JL2JKF";
    expect(amazonAffiliateUrl(url, null)).toBeNull();
    expect(amazonAffiliateUrl(url, "invalido")).toBeNull();
    expect(amazonAffiliateUrl(null, "dleysson-20")).toBeNull();
    expect(
      amazonAffiliateUrl("https://www.amazon.com.br/dp/B083JL2JKF?tag=outro-20", "dleysson-20"),
    ).toBeNull();
    expect(
      amazonAffiliateUrl("https://www.mercadolivre.com.br/p/MLB123", "dleysson-20"),
    ).toBeNull();
    expect(amazonAffiliateUrl("https://evil.com/dp/B083JL2JKF", "dleysson-20")).toBeNull();
  });
});
