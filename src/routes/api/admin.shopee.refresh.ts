import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/server/admin";
import { json } from "@/lib/server/auth";
import { refreshShopeePrices } from "../../robot/showcase";
import { isConfigured } from "../../services/server/shopeeAffiliateService";

export const Route = createFileRoute("/api/admin/shopee/refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        if (!isConfigured()) {
          return json({ error: "Configure SHOPEE_APP_ID e SHOPEE_APP_SECRET." }, { status: 503 });
        }
        return json(await refreshShopeePrices());
      },
    },
  },
});
