import { createFileRoute } from "@tanstack/react-router";
import { getUser, json } from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const Route = createFileRoute("/api/wishlist/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const user = await getUser(request);
        if (!user) return json({ error: "Não autenticado" }, { status: 401 });
        const body = (await request.json()) as {
          priority?: boolean;
          alert?: boolean;
          targetPrice?: number;
        };
        const result = await dbQuery(
          `UPDATE wishlists SET priority = COALESCE($1, priority), alert = COALESCE($2, alert), target_price = COALESCE($3, target_price)
           WHERE id = $4 AND user_id = $5 RETURNING id`,
          [body.priority ?? null, body.alert ?? null, body.targetPrice ?? null, params.id, user.id],
        );
        return result.rowCount
          ? json({ ok: true })
          : json({ error: "Item não encontrado" }, { status: 404 });
      },
      DELETE: async ({ request, params }) => {
        const user = await getUser(request);
        if (!user) return json({ error: "Não autenticado" }, { status: 401 });
        const result = await dbQuery("DELETE FROM wishlists WHERE id = $1 AND user_id = $2", [
          params.id,
          user.id,
        ]);
        return result.rowCount
          ? json({ ok: true })
          : json({ error: "Item não encontrado" }, { status: 404 });
      },
    },
  },
});
