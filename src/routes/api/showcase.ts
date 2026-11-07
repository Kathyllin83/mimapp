import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/server/admin";
import { json } from "@/lib/server/auth";
import { isVitrineStore } from "../../lib/vitrines";
import {
  createShowcaseItem,
  deleteShowcaseItem,
  listShowcase,
  toPublicOffer,
  updateShowcaseItem,
  validateShowcaseInput,
} from "../../robot/showcase";

export const Route = createFileRoute("/api/showcase")({
  server: {
    handlers: {
      // público: produtos da vitrine de uma loja (?store=amazon). Com ?raw=1 (admin): itens brutos.
      GET: async ({ request }) => {
        const sp = new URL(request.url).searchParams;
        const store = sp.get("store");
        if (store !== null && !isVitrineStore(store))
          return json({ error: "Loja inválida" }, { status: 400 });
        try {
          if (sp.get("raw") === "1") {
            const denied = await requireAdmin(request);
            if (denied) return denied;
            return json(await listShowcase(store ?? undefined));
          }
          if (!store) return json({ error: "Informe a loja" }, { status: 400 });
          const items = await listShowcase(store);
          return json(items.map(toPublicOffer), {
            headers: { "cache-control": "public, max-age=30" },
          });
        } catch (error) {
          console.error(error);
          return json([]);
        }
      },
      POST: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const v = validateShowcaseInput(
          (await request.json().catch(() => ({}))) as Record<string, unknown>,
        );
        if (!v.ok) return json({ error: v.error }, { status: 422 });
        return json({ ok: true, id: await createShowcaseItem(v.value) });
      },
      PUT: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        if (!Number.isInteger(body["id"]))
          return json({ error: "Dados inválidos" }, { status: 400 });
        const v = validateShowcaseInput(body);
        if (!v.ok) return json({ error: v.error }, { status: 422 });
        const ok = await updateShowcaseItem(body["id"] as number, v.value);
        return ok ? json({ ok: true }) : json({ error: "Produto não encontrado" }, { status: 404 });
      },
      DELETE: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        if (!Number.isInteger(body["id"]))
          return json({ error: "Dados inválidos" }, { status: 400 });
        await deleteShowcaseItem(body["id"] as number);
        return json({ ok: true });
      },
    },
  },
});
