import type { VitrineStore } from "./vitrines";

/**
 * Favorito ("bookmarklet") que o dono do site clica na página de um produto, no próprio navegador.
 * Lê título, imagem e preço que a página já mostra e copia tudo como texto para colar no painel.
 * Nada é buscado pelo servidor: quem abre a página é a pessoa, em um navegador normal.
 */
const BOOKMARKLET_SOURCE = `(function(){
try{
var d=document,q=function(s){return d.querySelector(s)};
var meta=function(p){var e=q('meta[property="'+p+'"],meta[name="'+p+'"],meta[itemprop="'+p+'"]');return e?e.content:''};
var title=meta('og:title')||(q('h1')?q('h1').innerText:'')||d.title;
var image=meta('og:image');
var price='',old='';
var ld=d.querySelectorAll('script[type="application/ld+json"]');
for(var i=0;i<ld.length&&!price;i++){
try{var j=JSON.parse(ld[i].textContent);var a=Array.isArray(j)?j:[j];
for(var k=0;k<a.length&&!price;k++){var o=a[k]&&a[k].offers;if(o){o=Array.isArray(o)?o[0]:o;price=o.price||o.lowPrice||''}}}catch(e){}
}
if(!price)price=meta('product:price:amount')||meta('price');
if(!price){var f=q('.andes-money-amount__fraction');if(f){var c=q('.andes-money-amount__cents');price=f.textContent.replace(/\\./g,'')+(c?'.'+c.textContent:'')}}
var of=q('.ui-pdp-price__original-value .andes-money-amount__fraction');
if(of){var oc=q('.ui-pdp-price__original-value .andes-money-amount__cents');old=of.textContent.replace(/\\./g,'')+(oc?'.'+oc.textContent:'')}
var t='MIMA-PRODUTO:'+JSON.stringify({v:1,url:location.origin+location.pathname,title:title,price:String(price||''),old_price:String(old||''),image_url:image});
var ok=function(){alert('Copiado! Agora cole no painel da Mimá.')};
var no=function(){prompt('Copie este texto e cole no painel da Mimá:',t)};
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok,no)}else{no()}
}catch(e){alert('Não consegui ler esta página.')}
})();`;

export const BOOKMARKLET_CODE = BOOKMARKLET_SOURCE.replace(/\n/g, "");
/** Endereço do favorito (javascript:...), pronto para arrastar para a barra de favoritos. */
export const BOOKMARKLET_HREF = `javascript:${encodeURIComponent(BOOKMARKLET_CODE)}`;

export interface PastedProduct {
  store: VitrineStore | null;
  title: string;
  /** no formato brasileiro, ex.: "89,90" */
  price: string;
  old_price: string;
  image_url: string;
  url: string;
}

const STORE_BY_HOST: [RegExp, VitrineStore][] = [
  [/(^|\.)mercadolivre\.com\.br$/, "mercado-livre"],
  [/(^|\.)shopee\.com\.br$/, "shopee"],
  [/(^|\.)amazon\.com\.br$/, "amazon"],
];

function toBrPrice(raw: unknown): string {
  const n = Number(
    String(raw ?? "")
      .replace(/[^\d.,]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) && n > 0 ? n.toFixed(2).replace(".", ",") : "";
}

/** Lê o texto copiado pelo favorito. Devolve null se não for um produto válido. */
export function parseProductPaste(text: string): PastedProduct | null {
  const i = text.indexOf("MIMA-PRODUTO:");
  if (i < 0) return null;
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text.slice(i + "MIMA-PRODUTO:".length).trim());
    if (!parsed || typeof parsed !== "object") return null;
    data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = str(data["title"])
    .replace(/\s*[|\-–—]\s*(Mercado\s?Livre|Shopee|Amazon(\.com\.br)?)[^|]*$/i, "")
    .slice(0, 200);
  if (!title) return null;
  let url = "";
  let store: VitrineStore | null = null;
  try {
    const u = new URL(str(data["url"]));
    if (u.protocol === "https:") {
      url = u.origin + u.pathname;
      store = STORE_BY_HOST.find(([re]) => re.test(u.hostname.toLowerCase()))?.[1] ?? null;
    }
  } catch {
    // sem url válida: segue só com os demais campos
  }
  const price = toBrPrice(data["price"]);
  let oldPrice = toBrPrice(data["old_price"]);
  const num = (s: string) => Number(s.replace(",", "."));
  if (oldPrice && price && num(oldPrice) <= num(price)) oldPrice = "";
  const image = str(data["image_url"]);
  return {
    store,
    title,
    price,
    old_price: oldPrice,
    image_url: image.startsWith("https://") ? image : "",
    url,
  };
}
