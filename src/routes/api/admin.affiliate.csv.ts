import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/server/admin";
import { json } from "@/lib/server/auth";
import { exportCsv, importCsv } from "../../robot/affiliate";

const MAX_CSV_BYTES = 2_000_000;

export const Route = createFileRoute("/api/admin/affiliate/csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const all = new URL(request.url).searchParams.get("all") === "1";
        const csv = await exportCsv({ onlyWithoutLink: !all });
        return new Response(csv, {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": 'attachment; filename="ofertas-afiliados.csv"',
          },
        });
      },
      POST: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const text = await request.text();
        if (text.length > MAX_CSV_BYTES)
          return json({ error: "Arquivo grande demais" }, { status: 413 });
        return json(await importCsv(text));
      },
    },
  },
});
