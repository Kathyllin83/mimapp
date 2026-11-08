import { describe, expect, it } from "vitest";
import { BOOKMARKLET_CODE, BOOKMARKLET_HREF, parseProductPaste } from "./bookmarklet";

const paste = (o: Record<string, unknown>) => `MIMA-PRODUTO:${JSON.stringify({ v: 1, ...o })}`;

describe("favorito: leitura da colagem", () => {
  it("preenche título, preço, preço anterior, imagem e detecta a loja", () => {
    const p = parseProductPaste(
      paste({
        url: "https://www.mercadolivre.com.br/jogo-potes/p/MLB42199747",
        title: "Jogo com 5 Potes de Vidro | Mercado Livre",
        price: "89.9",
        old_price: "129.9",
        image_url: "https://http2.mlstatic.com/D_NQ_NP_123.jpg",
      }),
    );
    expect(p).toEqual({
      store: "mercado-livre",
      title: "Jogo com 5 Potes de Vidro",
      price: "89,90",
      old_price: "129,90",
      image_url: "https://http2.mlstatic.com/D_NQ_NP_123.jpg",
      url: "https://www.mercadolivre.com.br/jogo-potes/p/MLB42199747",
    });
  });
  it("remove parâmetros de rastreio da URL e reconhece Shopee e Amazon", () => {
    const ml = parseProductPaste(
      paste({
        url: "https://www.mercadolivre.com.br/x/p/MLB1?matt_tool=1&ref=abc#frag",
        title: "X",
        price: "1",
      }),
    );
    expect(ml?.url).toBe("https://www.mercadolivre.com.br/x/p/MLB1");
    expect(
      parseProductPaste(paste({ url: "https://shopee.com.br/produto-i.1.2", title: "S", price: 5 }))
        ?.store,
    ).toBe("shopee");
    expect(
      parseProductPaste(
        paste({ url: "https://www.amazon.com.br/dp/B083JL2JKF", title: "A", price: "10" }),
      )?.store,
    ).toBe("amazon");
    expect(
      parseProductPaste(paste({ url: "https://outra-loja.com/p", title: "O", price: "10" }))?.store,
    ).toBeNull();
  });
  it("trata preço no formato brasileiro e descarta preço anterior que não seja maior", () => {
    expect(
      parseProductPaste(paste({ title: "T", price: "1.299,90", old_price: "1.500,00" })),
    ).toMatchObject({
      price: "1299,90",
      old_price: "1500,00",
    });
    expect(parseProductPaste(paste({ title: "T", price: "50", old_price: "50" }))?.old_price).toBe(
      "",
    );
    expect(parseProductPaste(paste({ title: "T", price: "" }))?.price).toBe("");
  });
  it("só aceita imagem https e rejeita colagens inválidas", () => {
    expect(
      parseProductPaste(paste({ title: "T", image_url: "http://x.com/a.jpg" }))?.image_url,
    ).toBe("");
    expect(parseProductPaste("texto qualquer")).toBeNull();
    expect(parseProductPaste("MIMA-PRODUTO:{nao é json")).toBeNull();
    expect(parseProductPaste(paste({ title: "   " }))).toBeNull();
  });
});

describe("favorito: código", () => {
  it("é uma linha só e vira um endereço javascript: seguro para o favorito", () => {
    expect(BOOKMARKLET_CODE).not.toContain("\n");
    expect(BOOKMARKLET_HREF.startsWith("javascript:")).toBe(true);
    expect(decodeURIComponent(BOOKMARKLET_HREF.slice("javascript:".length))).toBe(BOOKMARKLET_CODE);
  });
  it("não envia nada pela rede: só lê a página e copia para a área de transferência", () => {
    expect(BOOKMARKLET_CODE).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|new Image|\.src\s*=/);
    expect(BOOKMARKLET_CODE).toContain("clipboard");
  });
});

describe("favorito: execução numa página de produto", () => {
  const run = async (html: string) => {
    document.head.innerHTML = html;
    document.body.innerHTML = "";
    const copied: string[] = [];
    Object.assign(navigator, {
      clipboard: { writeText: (t: string) => (copied.push(t), Promise.resolve()) },
    });
    window.alert = () => {};
    window.prompt = () => null;
    (0, eval)(BOOKMARKLET_CODE);
    await new Promise((r) => setTimeout(r, 0));
    return copied[0] ?? null;
  };

  it("lê og:title, og:image e o preço do JSON-LD e copia no formato esperado", async () => {
    const text = await run(`
      <meta property="og:title" content="Jogo com 5 Potes de Vidro | Mercado Livre">
      <meta property="og:image" content="https://http2.mlstatic.com/D_1.jpg">
      <script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":89.9}}</script>`);
    expect(text).not.toBeNull();
    const p = parseProductPaste(text!);
    expect(p).toMatchObject({
      title: "Jogo com 5 Potes de Vidro",
      price: "89,90",
      image_url: "https://http2.mlstatic.com/D_1.jpg",
    });
  });

  it("usa a meta de preço quando não há JSON-LD", async () => {
    const text = await run(`
      <meta property="og:title" content="Produto X">
      <meta property="product:price:amount" content="1299.90">`);
    expect(parseProductPaste(text!)?.price).toBe("1299,90");
  });

  it("não quebra em página sem dados de produto", async () => {
    const text = await run(`<title>Página qualquer</title>`);
    expect(parseProductPaste(text!)?.title).toBe("Página qualquer");
  });
});
