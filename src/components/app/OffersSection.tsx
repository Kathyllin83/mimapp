import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock3, ExternalLink, ImageOff, Store } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/app/Editorial";
import { Section } from "@/components/app/ProductCard";
import { brl } from "@/lib/format";
import {
  OFFER_STORES,
  buyHref,
  discountLabel,
  formatUpdated,
  storeLabel,
  type ApiOffer,
  type ApiOffersPage,
} from "@/lib/offers";
import { cn } from "@/lib/utils";
import { VITRINE_STORES, isEmbeddable, isShopeeShortLink, type Vitrine } from "@/lib/vitrines";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORTS = [
  { value: "score", label: "Melhores ofertas" },
  { value: "price", label: "Menor preço" },
  { value: "recent", label: "Mais recentes" },
] as const;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

export function OffersSection({
  q,
  store,
  onStoreChange,
  forcedTopic,
}: {
  q: string;
  /** slug da loja (amazon, mercado-livre, shopee, aliexpress) ou "all" */
  store: string;
  onStoreChange: (store: string) => void;
  /** interesse imposto pela navegação de categorias da página */
  forcedTopic?: string | null;
}) {
  const [topic, setTopic] = useState<string | null>(null);
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("score");
  const [page, setPage] = useState(1);
  const activeTopic = forcedTopic ?? topic;

  const topics = useQuery({
    queryKey: ["offer-topics"],
    queryFn: () => getJson<{ slug: string; label: string }[]>("/api/offers/topics"),
    staleTime: 3_600_000,
  });

  const params = new URLSearchParams({ sort, page: String(page), per_page: "12" });
  if (activeTopic) params.set("topic", activeTopic);
  if (store !== "all") params.set("marketplace", store);
  if (q) params.set("q", q);
  const offers = useQuery({
    queryKey: ["offers", params.toString()],
    queryFn: () => getJson<ApiOffersPage>(`/api/offers?${params}`),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const data = offers.data;
  // vitrine configurada no admin; só Amazon, Mercado Livre e Shopee têm
  const vitrines = useQuery({
    queryKey: ["vitrines"],
    queryFn: () => getJson<Vitrine[]>("/api/vitrines"),
    staleTime: 60_000,
  });
  const hasVitrine = (VITRINE_STORES as readonly string[]).includes(store);
  // produtos da vitrine cadastrados no admin (preço e link informados pelo dono do site)
  const showcaseQuery = useQuery({
    queryKey: ["showcase", store],
    queryFn: () => getJson<ApiOffer[]>(`/api/showcase?store=${store}`),
    enabled: hasVitrine,
    staleTime: 60_000,
  });
  const showcase = hasVitrine ? (showcaseQuery.data ?? []) : [];
  const vitrine =
    hasVitrine && vitrines.data ? (vitrines.data.find((v) => v.store === store) ?? null) : null;
  // A Shopee não mostra botão para a vitrine: a aba exibe os produtos cadastrados, cada um com o seu link de compra.
  const vitrineCard = !!vitrine && store !== "shopee" && !isEmbeddable(vitrine.url);
  const vitrineFrame = !!vitrine && store !== "shopee" && isEmbeddable(vitrine.url);

  return (
    <Section title="Ofertas">
      <div className="store-tabs" role="tablist" aria-label="Lojas">
        {[{ slug: "all", label: "Todas as lojas" }, ...OFFER_STORES].map((s) => (
          <button
            key={s.slug}
            role="tab"
            aria-selected={store === s.slug}
            className={cn(store === s.slug && "is-active")}
            onClick={() => {
              onStoreChange(s.slug);
              setPage(1);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {vitrine && vitrineFrame && (
        <div className="store-vitrine">
          <iframe
            src={vitrine.url}
            title={vitrine.title ?? `Vitrine ${storeLabel(store)}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            style={{ height: vitrine.height }}
          />
        </div>
      )}
      {vitrine && vitrineCard && (
        <div className="store-vitrine-card">
          <div>
            <p className="eyebrow">Vitrine {storeLabel(store)}</p>
            <h3>{vitrine.title ?? `Minha vitrine na ${storeLabel(store)}`}</h3>
            <p>Veja a seleção completa direto na loja.</p>
          </div>
          <a className="offer-buy" href={vitrine.url} target="_blank" rel="noopener sponsored">
            Ver vitrine <ExternalLink size={16} />
          </a>
        </div>
      )}
      {showcase.length > 0 && (
        <>
          <h3 className="store-more">Vitrine {storeLabel(store)}</h3>
          <div className="offers-grid store-showcase">
            {showcase.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        </>
      )}
      {(showcase.length > 0 || vitrineCard || vitrineFrame) && (
        <h3 className="store-more">Mais ofertas em {storeLabel(store)}</h3>
      )}
      <div className="offers-toolbar">
        {!forcedTopic && (
          <div className="offers-chips" role="group" aria-label="Interesses">
            {[{ slug: null, label: "Todos" }, ...(topics.data ?? [])].map((t) => (
              <button
                key={t.slug ?? "all"}
                aria-pressed={topic === t.slug}
                className={cn("filter-chip", topic === t.slug && "is-active")}
                onClick={() => reset(setTopic)(t.slug)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="offers-sort">
          <span>Ordenar</span>
          <Select value={sort} onValueChange={(value) => reset(setSort)(value as typeof sort)}>
            <SelectTrigger className="offers-sort-trigger" aria-label="Ordenar ofertas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="offers-sort-menu" align="end">
              {SORTS.map((s) => (
                <SelectItem className="offers-sort-option" key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {offers.isPending ? (
        <div className="offers-grid" aria-busy="true" aria-label="Carregando ofertas">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="offer-skeleton" />
          ))}
        </div>
      ) : offers.isError ? (
        <EmptyState
          title="Não foi possível carregar as ofertas"
          description="Tente novamente em alguns instantes."
        >
          <button className="filter-chip" onClick={() => void offers.refetch()}>
            Tentar de novo
          </button>
        </EmptyState>
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          title="Nenhuma oferta encontrada"
          description={
            data?.freshness.stalled
              ? "A atualização das ofertas está pausada no momento. Volte em breve."
              : "Tente outro interesse, outra loja ou outra busca."
          }
        />
      ) : (
        <>
          <p className="offers-note">
            Os preços mudam a qualquer momento e podem ser diferentes na loja.
            {data.freshness.last_success_at && (
              <> Última atualização do catálogo: {formatUpdated(data.freshness.last_success_at)}.</>
            )}
            {data.freshness.stalled && " A coleta está pausada, exibindo o último dado."}
          </p>
          <div className="offers-grid">
            {data.data.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
          {data.last_page > 1 && (
            <nav className="offers-pager" aria-label="Paginação das ofertas">
              <button
                className="filter-chip"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={16} /> <span>Anterior</span>
              </button>
              <span className="offers-page-count">
                <span className="offers-page-current">{data.current_page}</span>
                <span className="offers-page-divider">/</span>
                <span>{data.last_page}</span>
                <span className="offers-page-label">Página</span>
              </span>
              <button
                className="filter-chip"
                disabled={page >= data.last_page}
                onClick={() => setPage((p) => p + 1)}
              >
                <span>Próxima</span> <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </>
      )}
    </Section>
  );
}

export function OfferCard({ offer }: { offer: ApiOffer }) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const label = discountLabel(offer);
  const rawHref = buyHref(offer);
  const needsShopeeResolution =
    offer.marketplace === "shopee" && !!rawHref && isShopeeShortLink(rawHref);
  const shopeeLink = useQuery({
    queryKey: ["shopee-link", rawHref],
    queryFn: () => getJson<{ url: string }>(`/api/shopee-link?url=${encodeURIComponent(rawHref!)}`),
    enabled: needsShopeeResolution,
    staleTime: 300_000,
    retry: 1,
  });
  const href = needsShopeeResolution ? (shopeeLink.data?.url ?? null) : rawHref;
  return (
    <div className="offer-item">
      <article className="offer-card">
        <div className={cn("offer-image", !loaded && !broken && offer.image_url && "is-loading")}>
          {offer.image_url && !broken ? (
            <img
              ref={(el) => {
                // imagem já em cache (ou hidratada antes do React): não espera o evento load
                if (el?.complete && el.naturalWidth > 0) setLoaded(true);
              }}
              className={cn(loaded && "is-loaded")}
              src={offer.image_url}
              alt={offer.title}
              width={400}
              height={400}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={() => setBroken(true)}
            />
          ) : (
            <div className="offer-placeholder" role="img" aria-label="Imagem indisponível">
              <ImageOff size={26} strokeWidth={1.5} />
              <span>{storeLabel(offer.marketplace)}</span>
            </div>
          )}
          {label?.kind === "validated" && <span className="product-discount">{label.badge}</span>}
        </div>
        <div className="product-copy">
          <p className="offer-store-badge">
            <Store size={17} strokeWidth={2.2} />
            {storeLabel(offer.marketplace)}
          </p>
          <h3>{offer.title}</h3>
          <div className="product-price">
            <strong>{brl(offer.price)}</strong>
            {offer.old_price !== null && offer.old_price > offer.price && (
              <del>{brl(offer.old_price)}</del>
            )}
          </div>
          {label?.kind === "informed" && (
            <p className="offer-informed">Preço informado pela loja</p>
          )}
          {label?.kind === "validated" && (
            <p className="offer-informed">Desconto confirmado pelo histórico de preços</p>
          )}
          <p className="offer-updated">
            <Clock3 size={17} />
            Atualizado em {formatUpdated(offer.updated_at)}
          </p>
        </div>
      </article>
      {href ? (
        <a className="offer-buy" href={href} target="_blank" rel="noopener sponsored">
          Ver na loja <ExternalLink size={14} />
        </a>
      ) : needsShopeeResolution ? (
        <button
          className="offer-buy"
          type="button"
          disabled={shopeeLink.isPending}
          onClick={() => void shopeeLink.refetch()}
        >
          {shopeeLink.isError ? "Tentar abrir na Shopee" : "Preparando link…"}
        </button>
      ) : null}
    </div>
  );
}
