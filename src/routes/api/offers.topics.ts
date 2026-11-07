import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/auth";
import { TOPIC_RULES } from "../../robot/topics";

export const Route = createFileRoute("/api/offers/topics")({
  server: {
    handlers: {
      GET: async () => json(TOPIC_RULES.map(({ slug, label }) => ({ slug, label }))),
    },
  },
});
