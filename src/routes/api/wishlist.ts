import { createFileRoute } from "@tanstack/react-router";
import { getUser, json } from "@/lib/server/auth";
import { dbQuery, dbTransaction } from "@/lib/server/db";

function item(row: Record<string, unknown>) {
  return {
    id: row["id"],
    name: row["name"],
    url: row["url"],
    image: row["image_url"],
    category: row["category_id"],
    currentPrice: Number(row["current_price"]),
    targetPrice: Number(row["target_price"]),
    priority: row["priority"],
    alert: row["alert"],
    createdAt: row["created_at"],
  };
}

export const Route = createFileRoute("/api/wishlist")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUser(request);
        if (!user) return json({ error: "Não autenticado" }, { status: 401 });
        const result = await dbQuery(
          `SELECT * FROM wishlists WHERE user_id = $1 ORDER BY priority DESC, created_at DESC`,
          [user.id],
        );
        return json({ items: result.rows.map(item) });
      },
      PUT: async ({ request }) => {
        const user = await getUser(request);
        if (!user) return json({ error: "Não autenticado" }, { status: 401 });
        const body = (await request.json()) as {
          items?: Array<{
            name: string;
            url?: string;
            image?: string;
            category: string;
            currentPrice: number;
            targetPrice: number;
            priority: boolean;
            alert: boolean;
          }>;
        };
        if (!Array.isArray(body.items)) return json({ error: "Lista inválida" }, { status: 400 });
        await dbTransaction(async (client) => {
          await client.query("DELETE FROM wishlists WHERE user_id = $1", [user.id]);
          for (const wish of body.items!) {
            await client.query(
              `INSERT INTO wishlists (user_id, name, url, image_url, category_id, current_price, target_price, priority, alert)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                user.id,
                wish.name,
                wish.url ?? null,
                wish.image ?? null,
                wish.category,
                wish.currentPrice ?? 0,
                wish.targetPrice ?? 0,
                wish.priority ?? false,
                wish.alert ?? false,
              ],
            );
          }
        });
        return json({ ok: true });
      },
      POST: async ({ request }) => {
        const user = await getUser(request);
        if (!user) return json({ error: "Não autenticado" }, { status: 401 });
        const body = (await request.json()) as {
          name?: string;
          url?: string;
          image?: string;
          category?: string;
          currentPrice?: number;
          targetPrice?: number;
          priority?: boolean;
          alert?: boolean;
        };
        if (!body.name?.trim() || !body.category)
          return json({ error: "Nome e categoria são obrigatórios" }, { status: 400 });
        const result = await dbQuery(
          `INSERT INTO wishlists (user_id, name, url, image_url, category_id, current_price, target_price, priority, alert)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            user.id,
            body.name.trim(),
            body.url ?? null,
            body.image ?? null,
            body.category,
            body.currentPrice ?? 0,
            body.targetPrice ?? 0,
            body.priority ?? false,
            body.alert ?? false,
          ],
        );
        return json({ item: item(result.rows[0] as Record<string, unknown>) }, { status: 201 });
      },
    },
  },
});
