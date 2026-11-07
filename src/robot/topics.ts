import { stripAccents } from "./normalize";

export type TopicSlug = "cabelos" | "maquiagem" | "perfume-feminino" | "skincare" | "casa";

export interface TopicRule {
  slug: TopicSlug;
  label: string;
  subcategories: string[];
  /** categorias da fonte (em slug, ex.: "cama-mesa-e-banho") que já definem o tópico */
  categories?: string[];
  keywords: string[];
  /** Exigidos além das palavras-chave (perfume feminino). */
  requireAny?: string[];
  exclude: string[];
}

export const TOPIC_RULES: TopicRule[] = [
  {
    slug: "cabelos",
    label: "Cabelos",
    subcategories: ["chapinha-secador-e-escova-secadora"],
    keywords: [
      "cabelo",
      "cabelos",
      "capilar",
      "shampoo",
      "xampu",
      "condicionador",
      "chapinha",
      "escova secadora",
      "anti-frizz",
      "antifrizz",
      "leave-in",
      "mascara capilar",
      "secador de cabelo",
    ],
    exclude: ["secador de roupa", "secador de roupas"],
  },
  {
    slug: "maquiagem",
    label: "Maquiagem",
    subcategories: ["maquiagens"],
    keywords: [
      "maquiagem",
      "batom",
      "base liquida",
      "corretivo",
      "rimel",
      "mascara de cilios",
      "sombra",
      "blush",
      "gloss",
      "po compacto",
      "iluminador",
      "delineador",
      "paleta",
    ],
    exclude: ["camera", "brinquedo", "infantil", "celular"],
  },
  {
    slug: "perfume-feminino",
    label: "Perfume feminino",
    // a própria fonte já classifica estes itens como perfume feminino
    subcategories: ["perfume-feminino"],
    keywords: [
      "perfume",
      "colonia",
      "edp",
      "edt",
      "eau de parfum",
      "eau de toilette",
      "body splash",
    ],
    requireAny: ["feminino", "feminina", "for women", "femme", "mulher", "pour femme"],
    exclude: ["masculino", "masculina", "for men", "homme", "pour homme"],
  },
  {
    slug: "skincare",
    label: "Skincare",
    subcategories: [],
    keywords: [
      "skincare",
      "skin care",
      "hidratante",
      "protetor solar",
      "filtro solar",
      "serum",
      "limpeza facial",
      "sabonete facial",
      "gel de limpeza",
      "creme facial",
      "creme para o rosto",
      "creme antissinais",
      "antissinais",
      "anti-idade",
      "retinol",
      "acido hialuronico",
      "vitamina c",
      "niacinamida",
      "agua micelar",
      "demaquilante",
      "esfoliante",
      "mascara facial",
      "tonico facial",
      "contorno dos olhos",
      "pos-sol",
      "loção hidratante",
      "locao hidratante",
      "protetor facial",
      "filtro solar facial",
    ],
    exclude: [
      "capilar",
      "cabelo",
      "cabelos",
      "shampoo",
      "xampu",
      "condicionador",
      "pet",
      "cachorro",
      "desodorante",
      "antitranspirante",
    ],
  },
  {
    slug: "casa",
    label: "Casa",
    subcategories: ["produtos-de-limpeza", "utilidades-variadas", "utensilios-domesticos"],
    categories: [
      "cama-mesa-e-banho",
      "utilidades-domesticas",
      "moveis-e-decoracao",
      "eletrodomesticos",
      "eletroportateis",
      "ferramentas-e-casa",
      "ar-e-ventilacao",
      "casa-e-construcao",
      "utensilios-domesticos",
    ],
    keywords: [
      "lencol",
      "toalha",
      "edredom",
      "cobertor",
      "travesseiro",
      "colcha",
      "cortina",
      "tapete",
      "almofada",
      "panela",
      "frigideira",
      "organizador",
      "ventilador",
      "aspirador",
      "liquidificador",
      "fritadeira",
      "cafeteira",
      "colchao",
      "sofa",
      "luminaria",
      "amaciante",
      "detergente",
      "desinfetante",
    ],
    exclude: ["perfume", "maquiagem", "batom", "shampoo", "colonia", "body splash"],
  },
];

function slugify(s: string) {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function norm(s: string) {
  return stripAccents(s).toLowerCase();
}
/** Casa por palavra inteira (ou frase inteira), sem acento e sem diferenciar maiúsculas. */
function has(text: string, term: string): boolean {
  const t = norm(term)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${t}($|[^a-z0-9])`).test(text);
}

export function classifyTopics(
  input: { title: string; subcategory?: string | null; category?: string | null },
  rules: TopicRule[] = TOPIC_RULES,
): TopicSlug[] {
  const text = norm(input.title);
  const sub = norm(input.subcategory ?? "");
  const cat = slugify(input.category ?? "");
  const out: TopicSlug[] = [];
  for (const r of rules) {
    if (r.exclude.some((e) => has(text, e))) continue;
    const bySub = r.subcategories.some((s) => sub === norm(s));
    const byCat = (r.categories ?? []).includes(cat);
    const byWord = r.keywords.some((k) => has(text, k));
    const base =
      bySub || byCat || (byWord && (!r.requireAny || r.requireAny.some((k) => has(text, k))));
    if (base) out.push(r.slug);
  }
  return out;
}
