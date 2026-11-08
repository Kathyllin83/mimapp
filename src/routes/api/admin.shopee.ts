import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/server/admin";
import { json } from "@/lib/server/auth";
import {
  ShopeeApiError,
  importFromShopeeUrl,
  isConfigured,
} from "../../services/server/shopeeAffiliateService";

export const Route = createFileRoute("/api/admin/shopee")({
  server: {
    handlers: {
      // a API de afiliados está configurada (SHOPEE_APP_ID e SHOPEE_APP_SECRET)?
      GET: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        return json({ configured: isConfigured() });
      },
      // busca o produto na API oficial e devolve os dados para preencher o formulário (não salva)
      POST: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const body = (await request.json().catch(() => ({}))) as { url?: unknown };
        if (typeof body.url !== "string" || !body.url.trim()) {
          return json({ error: "Informe o link do produto da Shopee." }, { status: 400 });
        }
        try {
          return json(await importFromShopeeUrl(body.url));
        } catch (error) {
          if (error instanceof ShopeeApiError)
            return json({ error: error.message }, { status: error.status });
          console.error(error);
          return json({ error: "Não foi possível buscar o produto." }, { status: 502 });
        }
      },
    },
  },
});
