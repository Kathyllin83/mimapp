import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/server/admin";
import { json } from "@/lib/server/auth";
import { isValidAmazonTag } from "../../robot/normalize";
import { getAmazonTag, removeAmazonTag, setAmazonTag } from "../../robot/settings";

export const Route = createFileRoute("/api/admin/amazon-tag")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        return json({ tag: await getAmazonTag() });
      },
      PUT: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const body = (await request.json().catch(() => ({}))) as { tag?: unknown };
        const tag = typeof body.tag === "string" ? body.tag.trim() : "";
        if (!isValidAmazonTag(tag)) {
          return json({ error: "Código inválido. Use o formato seusite-20." }, { status: 422 });
        }
        await setAmazonTag(tag);
        return json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        await removeAmazonTag();
        return json({ ok: true });
      },
    },
  },
});
