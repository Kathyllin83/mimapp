import type { MarketplaceSlug, SourceId } from "./config";

export interface NormalizedOffer {
  source: SourceId;
  externalId: string;
  title: string;
  imageUrl: string | null;
  marketplace: MarketplaceSlug;
  category: string | null;
  subcategory: string | null;
  price: number;
  oldPrice: number | null;
  /** "active" ou "closed" (expirada na fonte). */
  status: "active" | "closed";
  /** 0..100, normalizada por conector. */
  popularity: number;
  /** URL da página da fonte (uso interno, nunca exposta). */
  sourceUrl: string;
  /** URL limpa do produto (Amazon /dp/ASIN ou página de produto do ML), senão null. */
  cleanUrl: string | null;
}

export class StructureChangedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructureChangedError";
  }
}
