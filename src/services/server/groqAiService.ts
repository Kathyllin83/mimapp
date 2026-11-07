import type { AiAction, AiRequest, AiResponse } from "../contracts";
import { z } from "zod";
import { mercadoLivreServer } from "./mercadoLivreService";

const API_ROOT = "https://api.groq.com/openai/v1";
const TEXT_MODEL = process.env["GROQ_TEXT_MODEL"] || "openai/gpt-oss-20b";
const ADVANCED_MODEL = process.env["GROQ_ADVANCED_MODEL"] || "openai/gpt-oss-120b";
const VISION_MODEL = process.env["GROQ_VISION_MODEL"] || "qwen/qwen3.8-27b";
const MODELS_TTL_MS = 10 * 60_000;
const REQUEST_TIMEOUT_MS = 25_000;

let modelsCache: { ids: Set<string>; expiresAt: number } | undefined;
let circuitOpenUntil = 0;
let consecutiveFailures = 0;
const inFlight = new Map<string, Promise<AiResponse>>();
const recognitionSchema = z
  .object({
    productName: z.string().trim().min(1).max(160).nullable(),
    brand: z.string().trim().max(100).nullable(),
    category: z
      .enum([
        "perfumaria",
        "maquiagem",
        "skincare",
        "moda",
        "acessorios",
        "tecnologia",
        "casa",
        "outro",
      ])
      .nullable(),
    model: z.string().trim().max(100).nullable(),
    variant: z.string().trim().max(100).nullable(),
    volume: z.string().trim().max(60).nullable(),
    color: z.string().trim().max(60).nullable(),
    identifiers: z.object({ ean: z.string().nullable() }).strict(),
    confidence: z.number().min(0).max(1),
    needsConfirmation: z.boolean(),
    searchTerms: z.array(z.string().trim().min(1).max(120)).max(5),
  })
  .strict();

function apiKey() {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new AiServiceError("Configuração de IA ausente.", 503);
  return key;
}

export class AiServiceError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function availableModels(): Promise<Set<string>> {
  if (modelsCache && modelsCache.expiresAt > Date.now()) return modelsCache.ids;
  const response = await fetch(`${API_ROOT}/models`, {
    headers: { authorization: `Bearer ${apiKey()}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new AiServiceError("Não foi possível consultar os modelos da Groq.", 503);
  const data = (await response.json()) as { data?: Array<{ id?: string }> };
  const ids = new Set((data.data ?? []).flatMap((model) => (model.id ? [model.id] : [])));
  modelsCache = { ids, expiresAt: Date.now() + MODELS_TTL_MS };
  return ids;
}

function taskInstructions(action: AiAction) {
  const common =
    "Responda sempre em português brasileiro, com simpatia e objetividade. Não invente preços, ofertas, avaliações, disponibilidade ou fatos de catálogo. Se não houver dados verificados, deixe isso claro. Evite afirmar equivalência entre produtos sem evidência.";
  const tasks: Record<AiAction, string> = {
    cheapest:
      "Ajude a pessoa a buscar opções e explique que preços atuais precisam de fonte comercial verificada.",
    "identify-image":
      "Analise apenas informações visíveis. Responda somente com o JSON do esquema fornecido. Use null para dados não visíveis, nunca invente EAN, marca, modelo, volume, cor ou variante. Use confidence como estimativa, não garantia. Se não houver produto identificável, productName deve ser null e needsConfirmation true.",
    dupes:
      "Sugira semelhanças com cuidado. Separe notas declaradas, similaridade olfativa subjetiva e equivalência comprovada.",
    "compare-perfumes":
      "Compare os produtos mencionados por características conhecidas. Indique quando algo não puder ser confirmado.",
    "analyze-wishlist":
      "Ajude a organizar os desejos descritos pela usuária, sem alegar monitoramento de preços ativo.",
    "budget-alternatives":
      "Sugira critérios e alternativas dentro do orçamento informado, sem inventar preço atual ou disponibilidade.",
    "free-text":
      "Responda à pergunta e faça uma pergunta de esclarecimento se faltarem dados importantes.",
  };
  return `${common}\n${tasks[action]}`;
}

const PRICE_INTENT =
  /pre[çc]o|quanto (custa|est[aá]|sai)|valor|barat|promo|onde comprar|\bcomprar\b/i;
const PRICE_WORDS =
  /\b(qual|quanto|custa|est[aá]|sai|o|a|os|as|pre[çc]os?|valor|de|do|da|no|na|em|mais|barat[oa]s?|onde|comprar|para|pra|um|uma|me|diga|consulte|consultar|\?)\b/gi;

/** Busca ofertas reais quando a pergunta é sobre preço; vazio se a integração estiver desligada. */
async function priceContext(req: AiRequest): Promise<string> {
  if (req.imageDataUri || !mercadoLivreServer.enabled) return "";
  const wantsPrice =
    req.action === "cheapest" ||
    req.action === "budget-alternatives" ||
    PRICE_INTENT.test(req.prompt);
  if (!wantsPrice) return "";
  const query = req.prompt
    .replace(PRICE_WORDS, " ")
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const listings = await mercadoLivreServer.search(query);
  if (!listings.length) return "";
  const lines = listings
    .slice(0, 8)
    .map(
      (l) =>
        `- ${l.title} | R$ ${l.price.toFixed(2).replace(".", ",")}${l.shipping === 0 ? " | frete grátis" : ""} | ${l.originalUrl}`,
    )
    .join("\n");
  return `Ofertas verificadas no Mercado Livre em ${listings[0]?.fetchedAt} (dados reais, podem mudar a qualquer momento). Use SOMENTE estes preços, cite o link, avise que o preço pode variar e que são anúncios de vendedores diferentes (confira se o item é o mesmo produto/volume):\n${lines}`;
}

function requestKey(req: AiRequest, model: string) {
  // Deduplicação apenas em memória do servidor; não persistimos prompts pessoais.
  return `${model}:${req.action}:${req.prompt}:${req.imageDataUri ?? ""}`;
}

async function callGroq(req: AiRequest, model: string): Promise<AiResponse> {
  const key = apiKey();
  const prices = await priceContext(req);
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: taskInstructions(req.action) },
  ];
  if (prices) messages.push({ role: "system", content: prices });
  if (req.imageDataUri) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: req.prompt || "Descreva o produto visível, indicando incertezas." },
        { type: "image_url", image_url: { url: req.imageDataUri } },
      ],
    });
  } else {
    messages.push({ role: "user", content: req.prompt });
  }

  const doRequest = async (selectedModel: string, completionBudget = 2048): Promise<AiResponse> => {
    const structuredRecognition = Boolean(req.imageDataUri);
    const response = await fetch(`${API_ROOT}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        // O orçamento inclui o raciocínio, além da resposta visível.
        max_completion_tokens: completionBudget,
        ...(["openai/gpt-oss-20b", "openai/gpt-oss-120b"].includes(selectedModel)
          ? { reasoning_effort: "low", include_reasoning: false }
          : {}),
        temperature: 0.5,
        ...(structuredRecognition
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "product_recognition",
                  strict: true,
                  schema: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "productName",
                      "brand",
                      "category",
                      "model",
                      "variant",
                      "volume",
                      "color",
                      "identifiers",
                      "confidence",
                      "needsConfirmation",
                      "searchTerms",
                    ],
                    properties: {
                      productName: { type: ["string", "null"] },
                      brand: { type: ["string", "null"] },
                      category: {
                        type: ["string", "null"],
                        enum: [
                          "perfumaria",
                          "maquiagem",
                          "skincare",
                          "moda",
                          "acessorios",
                          "tecnologia",
                          "casa",
                          "outro",
                          null,
                        ],
                      },
                      model: { type: ["string", "null"] },
                      variant: { type: ["string", "null"] },
                      volume: { type: ["string", "null"] },
                      color: { type: ["string", "null"] },
                      identifiers: {
                        type: "object",
                        additionalProperties: false,
                        required: ["ean"],
                        properties: { ean: { type: ["string", "null"] } },
                      },
                      confidence: { type: "number" },
                      needsConfirmation: { type: "boolean" },
                      searchTerms: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            }
          : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      if (response.status === 429)
        throw new AiServiceError(
          "A Groq atingiu o limite temporário. Tente novamente em instantes.",
          429,
        );
      if (response.status >= 500)
        throw new AiServiceError("A assistente está temporariamente indisponível.", 503);
      throw new AiServiceError("A Groq não aceitou esta solicitação.", 502);
    }
    const data = (await response.json()) as {
      choices?: Array<{
        finish_reason?: string;
        message?: { content?: string | Array<{ text?: string }> };
      }>;
      usage?: { total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content.trim()
        : content
            ?.map((part) => part.text ?? "")
            .join("")
            .trim();
    if (!text) {
      console.warn("groq_empty_response", {
        model: selectedModel,
        finishReason: data.choices?.[0]?.finish_reason,
        completionBudget,
      });
      // Uma única tentativa adicional quando o raciocínio esgota o orçamento.
      if (data.choices?.[0]?.finish_reason === "length" && completionBudget < 4096)
        return doRequest(selectedModel, 4096);
      throw new AiServiceError(
        "A assistente não gerou uma resposta válida. Tente reformular.",
        502,
      );
    }
    let recognition: AiResponse["recognition"];
    let responseText = text;
    if (structuredRecognition) {
      let decoded: unknown;
      try {
        decoded = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      } catch {
        throw new AiServiceError(
          "Não consegui estruturar a identificação da imagem. Tente outra foto.",
          502,
        );
      }
      const validation = recognitionSchema.safeParse(decoded);
      if (!validation.success)
        throw new AiServiceError(
          "A identificação retornou dados incompletos. Tente outra foto.",
          502,
        );
      recognition = validation.data;
      if (recognition.identifiers.ean && !/^\d{8,14}$/.test(recognition.identifiers.ean)) {
        recognition.identifiers.ean = null;
      }
      responseText = recognition.productName
        ? `${recognition.productName}${recognition.brand ? ` — ${recognition.brand}` : ""}\n${recognition.category ? `Categoria: ${recognition.category}. ` : ""}${recognition.variant ? `Versão: ${recognition.variant}. ` : ""}${recognition.volume ? `Volume: ${recognition.volume}. ` : ""}Confiança estimada: ${Math.round(recognition.confidence * 100)}%.${recognition.needsConfirmation ? " Confirme os detalhes antes de continuar." : ""}`
        : "Não consegui identificar um produto com segurança. Tente uma foto mais nítida ou descreva o item.";
    }
    return {
      text: responseText,
      cached: false,
      isDemo: false,
      model: selectedModel,
      cost: data.usage?.total_tokens ?? 0,
      ...(recognition ? { recognition } : {}),
    } satisfies AiResponse;
  };

  const startedAt = Date.now();
  try {
    const result = await doRequest(model);
    consecutiveFailures = 0;
    // Métricas só agregadas: sem prompt, imagem ou conteúdo de resposta.
    console.info("groq_request", { model, tokens: result.cost, latencyMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    consecutiveFailures += 1;
    if (consecutiveFailures >= 5) circuitOpenUntil = Date.now() + 30_000;
    if (
      error instanceof AiServiceError &&
      error.status === 503 &&
      model !== ADVANCED_MODEL &&
      !req.imageDataUri
    ) {
      const fallback = await doRequest(ADVANCED_MODEL);
      consecutiveFailures = 0;
      console.info("groq_request", {
        model: ADVANCED_MODEL,
        tokens: fallback.cost,
        latencyMs: Date.now() - startedAt,
        fallback: true,
      });
      return fallback;
    }
    if (error instanceof AiServiceError) throw error;
    throw new AiServiceError(
      "A solicitação expirou ou houve uma falha de conexão. Tente novamente.",
      503,
    );
  }
}

export const aiService = {
  get isLive() {
    return Boolean(process.env["GROQ_API_KEY"]);
  },
  async ask(req: AiRequest): Promise<AiResponse> {
    if (Date.now() < circuitOpenUntil)
      throw new AiServiceError(
        "A assistente está se recuperando de uma falha. Tente novamente em instantes.",
        503,
      );
    if (req.imageDataUri && !/^data:image\/(jpeg|png|webp);base64,/.test(req.imageDataUri))
      throw new AiServiceError("Envie uma imagem JPG, PNG ou WebP válida.", 400);
    const available = await availableModels();
    const requested = req.imageDataUri
      ? VISION_MODEL
      : req.action === "compare-perfumes"
        ? ADVANCED_MODEL
        : TEXT_MODEL;
    if (!available.has(requested)) {
      if (req.imageDataUri)
        throw new AiServiceError(
          "O reconhecimento por imagem está temporariamente indisponível na Groq.",
          503,
        );
      if (!available.has(TEXT_MODEL))
        throw new AiServiceError("Nenhum modelo de texto configurado está disponível.", 503);
    }
    const model = available.has(requested) ? requested : TEXT_MODEL;
    const fingerprint = requestKey(req, model);
    const existing = inFlight.get(fingerprint);
    if (existing) return existing;
    const pending = callGroq(req, model).finally(() => inFlight.delete(fingerprint));
    inFlight.set(fingerprint, pending);
    return pending;
  },
};

export async function getAiModelStatus() {
  if (!process.env["GROQ_API_KEY"])
    return { configured: false, text: false, advanced: false, vision: false };
  try {
    const ids = await availableModels();
    return {
      configured: true,
      text: ids.has(TEXT_MODEL),
      advanced: ids.has(ADVANCED_MODEL),
      vision: ids.has(VISION_MODEL),
    };
  } catch {
    return { configured: true, text: false, advanced: false, vision: false };
  }
}
