import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getUser, json } from "@/lib/server/auth";
import { dbTransaction } from "@/lib/server/db";
import { AiServiceError, aiService, getAiModelStatus } from "@/services/server/groqAiService";
import type { AiAction } from "@/services/contracts";

const actions = [
  "cheapest",
  "identify-image",
  "dupes",
  "compare-perfumes",
  "analyze-wishlist",
  "budget-alternatives",
  "free-text",
] as const satisfies readonly AiAction[];
const schema = z.object({
  action: z.enum(actions),
  prompt: z.string().trim().max(3_000).default(""),
  imageDataUri: z.string().max(7_000_000).optional(),
});
const ipRequests = new Map<string, number[]>();
const IP_HOURLY_LIMIT = Number(process.env["AI_IP_HOURLY_LIMIT"] || 20);
const GLOBAL_DAILY_LIMIT = Number(process.env["AI_GLOBAL_DAILY_LIMIT"] || 5000);

class QuotaExceeded extends Error {
  constructor(public readonly scope: "account" | "global") {
    super("AI quota exceeded");
  }
}

function ipAllowed(request: Request) {
  const ip = request.headers.get("x-real-ip") ?? "unknown";
  const now = Date.now();
  const recent = (ipRequests.get(ip) ?? []).filter((at) => now - at < 60 * 60_000);
  if (recent.length >= IP_HOURLY_LIMIT) return false;
  recent.push(now);
  ipRequests.set(ip, recent);
  return true;
}

export const Route = createFileRoute("/api/ai")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUser(request);
        if (!user || user.role !== "admin")
          return json({ error: "Não autorizado." }, { status: 403 });
        return json(await getAiModelStatus());
      },
      POST: async ({ request }) => {
        try {
          const user = await getUser(request);
          if (!user)
            return json({ error: "Entre na sua conta para usar a assistente." }, { status: 401 });
          const isAdmin = user.role === "admin";
          if (!isAdmin && !ipAllowed(request))
            return json(
              { error: "Muitas solicitações deste acesso. Tente novamente mais tarde." },
              { status: 429 },
            );
          const contentLength = Number(request.headers.get("content-length") ?? 0);
          if (contentLength > 7_100_000)
            return json({ error: "A imagem excede o tamanho permitido." }, { status: 413 });
          const raw = await request.text();
          if (raw.length > 7_100_000)
            return json({ error: "A solicitação excede o tamanho permitido." }, { status: 413 });
          let decoded: unknown;
          try {
            decoded = JSON.parse(raw);
          } catch {
            return json({ error: "Solicitação inválida." }, { status: 400 });
          }
          const parsed = schema.safeParse(decoded);
          if (!parsed.success)
            return json({ error: "Confira a pergunta e tente novamente." }, { status: 400 });
          if (!parsed.data.prompt && !parsed.data.imageDataUri)
            return json({ error: "Escreva uma pergunta ou envie uma imagem." }, { status: 400 });
          if (!aiService.isLive)
            return json(
              { error: "A assistente ainda não está configurada no servidor." },
              { status: 503 },
            );
          if (
            parsed.data.imageDataUri &&
            !/^data:image\/(jpeg|png|webp);base64,/.test(parsed.data.imageDataUri)
          )
            return json({ error: "Use uma imagem JPG, PNG ou WebP." }, { status: 400 });

          const dailyLimit = Number(process.env["AI_DAILY_LIMIT"] || 10);
          // Até haver assinatura/billing no servidor, toda conta usa o limite gratuito.
          const monthlyLimit = Number(process.env["AI_FREE_MONTHLY_LIMIT"] || 3);
          const reserved = await dbTransaction(async (client) => {
            // Admin não tem cota por conta; o limite global diário continua valendo.
            const account = isAdmin
              ? { rowCount: 1, rows: [{ monthly_count: 0 }] }
              : await client.query(
                  `INSERT INTO ai_usage (user_id, day_start, month_start, daily_count, monthly_count)
               VALUES ($1, current_date, date_trunc('month', current_date)::date, 1, 1)
               ON CONFLICT (user_id) DO UPDATE SET
                 day_start = current_date,
                 month_start = date_trunc('month', current_date)::date,
                 daily_count = CASE WHEN ai_usage.day_start = current_date THEN ai_usage.daily_count + 1 ELSE 1 END,
                 monthly_count = CASE WHEN ai_usage.month_start = date_trunc('month', current_date)::date THEN ai_usage.monthly_count + 1 ELSE 1 END,
                 updated_at = now()
               WHERE (CASE WHEN ai_usage.day_start = current_date THEN ai_usage.daily_count ELSE 0 END) < $2
                 AND (CASE WHEN ai_usage.month_start = date_trunc('month', current_date)::date THEN ai_usage.monthly_count ELSE 0 END) < $3
               RETURNING daily_count, monthly_count`,
                  [user.id, dailyLimit, monthlyLimit],
                );
            if (!account.rowCount) throw new QuotaExceeded("account");
            const global = await client.query(
              `INSERT INTO ai_global_usage (singleton, day_start, daily_count)
               VALUES (true, current_date, 1)
               ON CONFLICT (singleton) DO UPDATE SET
                 day_start = current_date,
                 daily_count = CASE WHEN ai_global_usage.day_start = current_date THEN ai_global_usage.daily_count + 1 ELSE 1 END,
                 updated_at = now()
               WHERE (CASE WHEN ai_global_usage.day_start = current_date THEN ai_global_usage.daily_count ELSE 0 END) < $1
               RETURNING daily_count`,
              [GLOBAL_DAILY_LIMIT],
            );
            if (!global.rowCount) throw new QuotaExceeded("global");
            return account.rows[0];
          });
          const result = await aiService.ask(parsed.data);
          return json({
            ...result,
            remaining: Math.max(0, monthlyLimit - Number(reserved["monthly_count"])),
          });
        } catch (error) {
          if (error instanceof QuotaExceeded)
            return json(
              {
                error:
                  error.scope === "global"
                    ? "A assistente atingiu o limite diário de uso. Tente novamente amanhã."
                    : "Você atingiu o limite de consultas deste plano. Tente novamente no próximo período.",
              },
              { status: 429 },
            );
          if (error instanceof AiServiceError)
            return json({ error: error.message }, { status: error.status });
          console.error("ai_request_failed", error instanceof Error ? error.name : "unknown");
          return json(
            { error: "A assistente está temporariamente indisponível." },
            { status: 503 },
          );
        }
      },
    },
  },
});
