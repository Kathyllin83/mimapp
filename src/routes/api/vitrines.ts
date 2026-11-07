import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/server/admin";
import { json } from "@/lib/server/auth";
import {
  isVitrineStore,
  listVitrines,
  removeVitrine,
  setVitrine,
  validateVitrine,
} from "../../robot/vitrines";

export const Route = createFileRoute("/api/vitrines")({
  server: {
    handlers: {
      // público: a vitrine é exibida a qualquer visitante
      GET: async () => {
        try {
          return json(await listVitrines(), { headers: { "cache-control": "public, max-age=30" } });
        } catch (error) {
          console.error(error);
          return json([]);
        }
      },
      PUT: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        if (!isVitrineStore(body["store"]))
          return json({ error: "Loja inválida" }, { status: 400 });
        const v = validateVitrine({
          url: body["url"],
          title: body["title"],
          height: body["height"],
        });
        if (!v.ok) return json({ error: v.error }, { status: 422 });
        await setVitrine(body["store"], v);
        return json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        if (!isVitrineStore(body["store"]))
          return json({ error: "Loja inválida" }, { status: 400 });
        await removeVitrine(body["store"]);
        return json({ ok: true });
      },
    },
  },
});
