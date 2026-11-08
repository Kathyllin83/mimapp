import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/server/admin";
import { json } from "@/lib/server/auth";
import { exportShowcaseCsv, importShowcaseCsv } from "../../robot/showcase";

const MAX_CSV_BYTES = 2_000_000;

export const Route = createFileRoute("/api/showcase/csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        return new Response(await exportShowcaseCsv(), {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": 'attachment; filename="produtos-da-vitrine.csv"',
          },
        });
      },
      POST: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const text = await request.text();
        if (text.length > MAX_CSV_BYTES)
          return json({ error: "Arquivo grande demais" }, { status: 413 });
        return json(await importShowcaseCsv(text));
      },
    },
  },
});
