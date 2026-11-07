import type { MarketplaceId, Offer } from "@/lib/types";

/** Contrato comum para integrações individuais com cada marketplace. */
export interface MarketplaceService {
  id: MarketplaceId;
  /** Indica se a integração real está ativa. Nesta fase: sempre false. */
  enabled: boolean;
  search(query: string): Promise<Offer[]>;
  getOffer(productId: string): Promise<Offer | null>;
}

export interface AiRequest {
  action: AiAction;
  prompt: string;
  imageDataUri?: string | undefined;
}
export type AiAction =
  | "cheapest"
  | "identify-image"
  | "dupes"
  | "compare-perfumes"
  | "analyze-wishlist"
  | "budget-alternatives"
  | "free-text";

export interface AiResponse {
  text: string;
  cached: boolean;
  isDemo: boolean;
  model: string;
  recognition?: ProductRecognition;
  /** custo estimado em créditos — para monitoramento futuro */
  cost: number;
}

export interface ProductRecognition {
  productName: string | null;
  brand: string | null;
  category: string | null;
  model: string | null;
  variant: string | null;
  volume: string | null;
  color: string | null;
  identifiers: { ean: string | null };
  confidence: number;
  needsConfirmation: boolean;
  searchTerms: string[];
}

export interface PushRegistration {
  userId: string;
  platform: "android" | "ios" | "web";
  token: string;
}

export interface AffiliateLinks {
  originalUrl: string;
  affiliateUrl: string | null;
}
