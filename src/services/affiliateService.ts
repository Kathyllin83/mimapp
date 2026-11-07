import type { Offer } from "@/lib/types";
import type { AffiliateLinks } from "./contracts";

/** Link original e de afiliado são sempre armazenados separadamente. */
export const affiliateService = {
  enabled: false,
  links(offer: Offer): AffiliateLinks {
    return { originalUrl: offer.originalUrl, affiliateUrl: offer.affiliateUrl ?? null };
  },
  /** URL usada no botão: afiliado quando existir, senão a original. */
  outboundUrl(offer: Offer) {
    return offer.affiliateUrl || offer.originalUrl;
  },
};
