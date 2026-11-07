import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/server/admin";
import { json } from "@/lib/server/auth";
import { listForAdmin, removeAffiliateLink, setAffiliateLink } from "../../robot/affiliate";

export const Route = createFileRoute("/api/admin/affiliate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const sp = new URL(request.url).searchParams;
        const list = await listForAdmin({
          marketplace: sp.get("marketplace"),
          onlyWithoutLink: sp.get("only_without_link") === "1",
          q: sp.get("q")?.trim().slice(0, 100) || null,
          page: Number(sp.get("page")) || 1,
          perPage: Number(sp.get("per_page")) || 50,
        });
        return json(list);
      },
      PUT: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const body = (await request.json().catch(() => ({}))) as { offerId?: number; url?: string };
        if (!Number.isInteger(body.offerId) || typeof body.url !== "string") {
          return json({ error: "Dados inválidos" }, { status: 400 });
        }
        const res = await setAffiliateLink(body.offerId as number, body.url);
        return res.ok ? json({ ok: true }) : json({ error: res.error }, { status: 422 });
      },
      DELETE: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const body = (await request.json().catch(() => ({}))) as { offerId?: number };
        if (!Number.isInteger(body.offerId))
          return json({ error: "Dados inválidos" }, { status: 400 });
        await removeAffiliateLink(body.offerId as number);
        return json({ ok: true });
      },
    },
  },
});
