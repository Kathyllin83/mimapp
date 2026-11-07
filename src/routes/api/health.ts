import { createFileRoute } from "@tanstack/react-router";
import { dbQuery } from "@/lib/server/db";
import { json } from "@/lib/server/auth";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await dbQuery("SELECT 1");
          return json({ ok: true, database: "postgres" });
        } catch (error) {
          console.error(error);
          return json({ ok: false, database: "unavailable" }, { status: 503 });
        }
      },
    },
  },
});
