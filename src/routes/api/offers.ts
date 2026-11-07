import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/auth";
import { listOffers, parseOffersQuery } from "../../robot/queries";

export const Route = createFileRoute("/api/offers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const page = await listOffers(parseOffersQuery(new URL(request.url).searchParams));
          return json(page, { headers: { "cache-control": "public, max-age=60" } });
        } catch (error) {
          console.error(error);
          return json({ error: "offers_unavailable" }, { status: 503 });
        }
      },
    },
  },
});
