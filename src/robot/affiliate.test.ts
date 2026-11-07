import { describe, expect, it } from "vitest";
import { parseCsv, validateAffiliateLink } from "./affiliate";

describe("validação do link de afiliado", () => {
  it("aceita só https nos domínios permitidos e da mesma loja", () => {
    expect(validateAffiliateLink("https://amzn.to/3abc", "amazon")).toBeNull();
    expect(validateAffiliateLink("https://meli.la/xyz", "mercado-livre")).toBeNull();
    expect(validateAffiliateLink("https://shope.ee/abc", "shopee")).toBeNull();
    expect(validateAffiliateLink("https://s.click.aliexpress.com/e/_x", "aliexpress")).toBeNull();
  });
  it("rejeita domínio fora da lista, http e loja diferente", () => {
    expect(validateAffiliateLink("https://evil.com/amzn.to", "amazon")).not.toBeNull();
    expect(validateAffiliateLink("http://amzn.to/x", "amazon")).not.toBeNull();
    expect(validateAffiliateLink("https://amzn.to/x", "shopee")).toMatch(/não é da loja/);
  });
  it("não altera o link (só confere)", () => {
    expect(validateAffiliateLink("  https://amzn.to/3abc?tag=meu-20  ", "amazon")).toBeNull();
  });
});

describe("planilha CSV", () => {
  it("detecta ; e , e respeita aspas", () => {
    expect(parseCsv('id;titulo\r\n1;"Perfume; Feminino ""X"""\r\n')).toEqual([
      ["id", "titulo"],
      ["1", 'Perfume; Feminino "X"'],
    ]);
    expect(parseCsv("id,link\n2,https://amzn.to/a\n")).toEqual([
      ["id", "link"],
      ["2", "https://amzn.to/a"],
    ]);
  });
  it("ignora BOM e linhas vazias", () => {
    expect(parseCsv("﻿id;x\n\n3;y\n")).toEqual([
      ["id", "x"],
      ["3", "y"],
    ]);
  });
});
