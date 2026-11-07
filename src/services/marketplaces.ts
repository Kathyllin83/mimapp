import type { MarketplaceId } from "@/lib/types";
import type { MarketplaceService } from "./contracts";

function marketplaceAdapter(id: MarketplaceId): MarketplaceService {
  return {
    id,
    enabled: false,
    async search() {
      return [];
    },
    async getOffer(_productId) {
      return null;
    },
  };
}

// Cada marketplace terá sua própria implementação (API oficial / afiliados) no backend.
export const amazonService = marketplaceAdapter("amazon");
export const mercadoLivreService = marketplaceAdapter("mercadolivre");
export const shopeeService = marketplaceAdapter("shopee");

export const marketplaceServices = [amazonService, mercadoLivreService, shopeeService];

export async function compareOffers(productId: string) {
  const offers = await Promise.all(marketplaceServices.map((s) => s.getOffer(productId)));
  return offers.filter((o) => o !== null);
}
