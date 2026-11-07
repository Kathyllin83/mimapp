import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import hero from "@/assets/hero-perfume.jpg";
import { Section } from "@/components/app/ProductCard";
import { EmptyState } from "@/components/app/Editorial";
import { CATEGORIES } from "@/lib/catalog";
import { MARKETPLACES } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { CategoryId, MarketplaceId } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/explorar")({
  head: () => ({
    meta: [
      { title: "Explorar promoções — Mimá" },
      {
        name: "description",
        content: "Descubra a seleção MIMÁ e organize seus desejos de compra.",
      },
      { property: "og:title", content: "Explorar promoções — Mimá" },
      {
        property: "og:description",
        content: "Explore o catálogo e organize seus desejos de compra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Explore,
});

function Explore() {
  const { user } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategoryId | null>(null);
  const [store, setStore] = useState<MarketplaceId | "all">("all");
  const [filters, setFilters] = useState(false);
  const searching = !!q.trim() || !!cat || store !== "all";
  return (
    <div className="explore-page">
      <header className="explore-heading">
        <div>
          <p className="eyebrow">
            Uma curadoria para você{user ? `, ${user.name.split(" ")[0]}` : ""}
          </p>
          <h1>
            Seu próximo <em>achado.</em>
          </h1>
          <p className="page-subtitle">Coisas que encantam. Escolhas que fazem sentido.</p>
        </div>
        <span className="edition-label">
          MIMÁ / EDITION 01
          <br />O prazer de descobrir
        </span>
      </header>
      <div className="search-row">
        <label className="discovery-search">
          <Search size={20} />
          <input
            aria-label="Buscar produtos"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="O que você está desejando?"
          />
          {q && (
            <button aria-label="Limpar busca" onClick={() => setQ("")}>
              <X size={18} />
            </button>
          )}
        </label>
        <button
          className={cn("filter-button", filters && "is-active")}
          aria-label="Filtrar por loja"
          aria-expanded={filters}
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal size={19} />
          <span>Filtros</span>
        </button>
      </div>
      {filters && (
        <div className="store-filters animate-rise" aria-label="Lojas">
          {(["all", "amazon", "mercadolivre", "shopee"] as const).map((m) => (
            <button
              key={m}
              aria-pressed={store === m}
              className={cn("filter-chip", store === m && "is-active")}
              onClick={() => setStore(m)}
            >
              {m === "all" ? "Todas as lojas" : MARKETPLACES[m].label}
            </button>
          ))}
        </div>
      )}
      <div className="category-nav" aria-label="Categorias">
        {[{ id: null, label: "Para você" }, ...CATEGORIES].map((c) => (
          <button
            key={c.label}
            aria-pressed={cat === c.id}
            onClick={() => setCat(c.id)}
            className={cn(cat === c.id && "is-active")}
          >
            {c.label}
          </button>
        ))}
      </div>
      {searching && (
        <Section title="Catálogo">
          <EmptyState
            title="Nenhum produto encontrado"
            description="O catálogo ainda não está disponível. Tente novamente quando houver produtos cadastrados."
          />
        </Section>
      )}
      {!searching && (
        <>
          <section className="editorial-feature">
            <div className="feature-copy">
              <p className="eyebrow">O universo MIMÁ / Perfumaria</p>
              <h2>
                Um novo aroma.
                <br />
                <em>Mais a sua cara.</em>
              </h2>
              <p>Descubra fragrâncias que combinam com você — e com o seu momento.</p>
              <button className="editorial-cta" onClick={() => setCat("perfumaria")}>
                Explorar perfumaria <ArrowRight size={17} />
              </button>
            </div>
            <div className="feature-photo">
              <img
                src={hero}
                alt="Frasco de perfume sobre cetim bordô"
                width={1600}
                height={960}
                fetchPriority="high"
              />
            </div>
          </section>
          <Section title="Catálogo">
            <EmptyState
              title="Produtos em breve"
              description="A seleção de produtos aparecerá aqui quando o catálogo estiver disponível."
            />
          </Section>
          <Link to="/desejos" className="wishlist-prompt">
            <span className="wishlist-prompt-kicker">Seu espaço de desejos</span>
            <div className="wishlist-prompt-content">
              <div>
                <h2>
                  Guarde agora.
                  <br />
                  <em>Escolha no seu tempo.</em>
                </h2>
                <p>Salve o que você procura e acompanhe seus desejos em um só lugar.</p>
              </div>
              <span className="wishlist-prompt-action" aria-hidden="true">
                <ArrowRight size={21} />
              </span>
            </div>
          </Link>
          <Link to="/assistente" className="assistant-invitation">
            <span className="assistant-seal">m.</span>
            <div>
              <p className="eyebrow">Sua assistente pessoal</p>
              <h2>Uma segunda opinião, com o seu gosto.</h2>
              <p>Compare, descubra alternativas e escolha com mais confiança.</p>
            </div>
            <ArrowRight size={24} />
          </Link>
        </>
      )}
    </div>
  );
}
