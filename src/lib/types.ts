export type MarketplaceId = "amazon" | "mercadolivre" | "shopee";

export type CategoryId =
  "perfumaria" | "maquiagem" | "skincare" | "moda" | "acessorios" | "tecnologia" | "casa";

export interface Category {
  id: CategoryId;
  label: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: CategoryId;
  image: string;
  /** Preço atual do produto, fornecido pelo catálogo conectado. */
  price: number;
  oldPrice?: number;
  store: MarketplaceId;
  tags: ("alta" | "dia" | "desejado" | "achadinho")[];
}

/** Oferta de um marketplace. Link original e link de afiliado são armazenados separadamente. */
export interface Offer {
  productId: string;
  marketplace: MarketplaceId;
  price: number;
  shipping?: number | null;
  sellerRating?: number | null;
  originalUrl: string;
  affiliateUrl?: string | null;
  isDemo: boolean;
  fetchedAt?: string | null;
}

export interface WishItem {
  id: string;
  name: string;
  url?: string | undefined;
  image?: string;
  category: CategoryId;
  currentPrice: number;
  targetPrice: number;
  priority: boolean;
  alert: boolean;
  createdAt: string;
}

export type NotificationKind = "queda" | "alvo" | "oferta" | "favorito" | "limite";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export type PlanId = "free" | "premium" | "plus";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  maxTracked: number;
  aiQueriesMonthly: number;
  features: string[];
}

export interface Dupe {
  id: string;
  name: string;
  brand: string;
  image: string;
  priceRange: [number, number];
  notes: string[];
  similarities: string;
  differences: string;
  rating?: number | null;
  similarity: number;
}

export interface DupeTarget {
  id: string;
  name: string;
  brand: string;
  image: string;
  priceRange: [number, number];
  notes: string[];
  dupes: Dupe[];
}
