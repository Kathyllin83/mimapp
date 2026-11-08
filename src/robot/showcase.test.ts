import { describe, expect, it } from "vitest";
import {
  parseShowcaseCsv,
  toPublicOffer,
  validateShowcaseInput,
  type ShowcaseItem,
} from "./showcase";

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
      source_url: null,
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

describe("planilha de produtos da vitrine", () => {
  it("lê linhas novas e existentes, com ; ou ,", () => {
    const csv =
      "id;loja;titulo;preco;preco_anterior;url_da_imagem;seu_link_de_afiliado\r\n" +
      ';mercado-livre;"Jogo de potes; vidro";89,90;129,90;https://img.test/a.jpg;https://meli.la/abc\r\n' +
      "7;amazon;Perfume X;50;;;https://amzn.to/x\r\n";
    const { rows, errors } = parseShowcaseCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      line: 2,
      id: null,
      body: { store: "mercado-livre", title: "Jogo de potes; vidro", price: "89,90" },
    });
    expect(rows[1]).toMatchObject({
      id: 7,
      body: { store: "amazon", old_price: "", image_url: "" },
    });
    expect(validateShowcaseInput(rows[0]!.body).ok).toBe(true);
    expect(validateShowcaseInput(rows[1]!.body).ok).toBe(true);
  });
  it("valida cada linha com as mesmas regras do cadastro", () => {
    const { rows } = parseShowcaseCsv(
      "loja,titulo,preco,seu_link_de_afiliado\nshopee,Produto,10,https://amzn.to/x\nmercado-livre,Produto,10,https://meli.la/ok\n",
    );
    expect(validateShowcaseInput(rows[0]!.body).ok).toBe(false); // link de outra loja
    expect(validateShowcaseInput(rows[1]!.body).ok).toBe(true);
  });
  it("recusa cabeçalho sem as colunas obrigatórias e id inválido", () => {
    expect(parseShowcaseCsv("titulo;preco\nX;1\n").errors[0]?.error).toMatch(/faltam as colunas/);
    const r = parseShowcaseCsv(
      "id;loja;titulo;preco;seu_link_de_afiliado\nabc;amazon;X;1;https://amzn.to/x\n",
    );
    expect(r.rows).toEqual([]);
    expect(r.errors[0]).toMatchObject({ line: 2, error: "id inválido" });
  });
});

describe("página de origem do produto", () => {
  it("aceita só URL https e é opcional", () => {
    const base = { ...ok };
    expect(validateShowcaseInput(base)).toMatchObject({ ok: true, value: { source_url: null } });
    expect(
      validateShowcaseInput({ ...base, source_url: "https://shopee.com.br/product/1/2" }),
    ).toMatchObject({ ok: true, value: { source_url: "https://shopee.com.br/product/1/2" } });
    expect(validateShowcaseInput({ ...base, source_url: "http://shopee.com.br/x" }).ok).toBe(false);
    expect(validateShowcaseInput({ ...base, source_url: "javascript:alert(1)" }).ok).toBe(false);
  });
});
