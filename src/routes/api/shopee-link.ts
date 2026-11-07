import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/auth";
import { isShopeeShortLink } from "@/lib/vitrines";

const SHOPEE_HOST = /(^|\.)shopee\.com\.br$/;

function isShopeeProductUrl(url: URL) {
  return url.protocol === "https:" && SHOPEE_HOST.test(url.hostname.toLowerCase());
}

export const Route = createFileRoute("/api/shopee-link")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("url") ?? "";
        if (!isShopeeShortLink(raw)) return json({ error: "link inválido" }, { status: 400 });

        try {
          let current = new URL(raw);
          for (let hop = 0; hop < 6; hop++) {
            const response = await fetch(current, {
              method: "HEAD",
              redirect: "manual",
              headers: { "user-agent": "Mozilla/5.0 Mimá/1.0" },
              signal: AbortSignal.timeout(5000),
            });

            if (response.status >= 300 && response.status < 400) {
              const location = response.headers.get("location");
              if (!location)
                return json({ error: "redirecionamento sem destino" }, { status: 502 });
              const next = new URL(location, current);
              if (!isShopeeProductUrl(next)) {
                return json({ error: "destino Shopee inválido" }, { status: 502 });
              }
              current = next;
              continue;
            }

            if (response.ok && isShopeeProductUrl(current)) {
              return json({ url: current.href }, { headers: { "cache-control": "no-store" } });
            }
            return json({ error: "não foi possível resolver o link da Shopee" }, { status: 502 });
          }
          return json({ error: "redirecionamento excedeu o limite" }, { status: 502 });
        } catch {
          return json({ error: "não foi possível resolver o link da Shopee" }, { status: 502 });
        }
      },
    },
  },
});
