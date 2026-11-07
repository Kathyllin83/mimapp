import { beforeEach, describe, expect, it, vi } from "vitest";

const activeModels = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];
const sampleRecognition = {
  productName: "Paradoxe Eau de Parfum",
  brand: "Prada",
  category: "perfumaria",
  model: null,
  variant: null,
  volume: null,
  color: null,
  identifiers: { ean: null },
  confidence: 0.82,
  needsConfirmation: true,
  searchTerms: ["Prada Paradoxe Eau de Parfum"],
};

function modelsResponse(ids = activeModels) {
  return new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), { status: 200 });
}

function completionResponse(content: string | null, status = 200) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }], usage: { total_tokens: 31 } }),
    { status },
  );
}

describe("Groq AI service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env["GROQ_API_KEY"] = "test-only-key";
  });

  it("answers a text question using the configured economical model", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(modelsResponse())
      .mockResolvedValueOnce(completionResponse("Uma resposta objetiva."));
    vi.stubGlobal("fetch", fetchMock);
    const { aiService } = await import("./groqAiService");

    const result = await aiService.ask({ action: "free-text", prompt: "Ajude-me a escolher." });

    expect(result.text).toBe("Uma resposta objetiva.");
    expect(result.model).toBe("openai/gpt-oss-20b");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends an image only to the configured vision model", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(modelsResponse())
      .mockResolvedValueOnce(completionResponse(JSON.stringify(sampleRecognition)));
    vi.stubGlobal("fetch", fetchMock);
    const { aiService } = await import("./groqAiService");

    const result = await aiService.ask({
      action: "identify-image",
      prompt: "Identifique este produto.",
      imageDataUri: "data:image/png;base64,aW1hZ2U=",
    });

    expect(result.model).toBe("qwen/qwen3.8-27b");
    expect(result.recognition?.brand).toBe("Prada");
    expect(result.recognition?.needsConfirmation).toBe(true);
    expect(result.text).toContain("Confiança estimada: 82%");
    expect(JSON.stringify(fetchMock.mock.calls[1]?.[1]?.body)).toContain("image_url");
    expect(JSON.stringify(fetchMock.mock.calls[1]?.[1]?.body)).toContain("json_schema");
  });

  it("represents an ambiguous image without inventing product details", async () => {
    const ambiguous = {
      productName: null,
      brand: null,
      category: null,
      model: null,
      variant: null,
      volume: null,
      color: null,
      identifiers: { ean: null },
      confidence: 0.18,
      needsConfirmation: true,
      searchTerms: [],
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(modelsResponse())
        .mockResolvedValueOnce(completionResponse(JSON.stringify(ambiguous))),
    );
    const { aiService } = await import("./groqAiService");

    const result = await aiService.ask({
      action: "identify-image",
      prompt: "Identifique.",
      imageDataUri: "data:image/png;base64,aW1hZ2U=",
    });
    expect(result.recognition?.productName).toBeNull();
    expect(result.recognition?.identifiers.ean).toBeNull();
    expect(result.text).toContain("Não consegui identificar");
  });

  it("rejects image responses that do not match the product schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(modelsResponse())
        .mockResolvedValueOnce(completionResponse('{"productName":"produto"}')),
    );
    const { aiService } = await import("./groqAiService");

    await expect(
      aiService.ask({
        action: "identify-image",
        prompt: "Identifique.",
        imageDataUri: "data:image/png;base64,aW1hZ2U=",
      }),
    ).rejects.toThrow(/dados incompletos/i);
  });

  it("returns a clear error when the visual model is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(modelsResponse(activeModels.slice(0, 2))));
    const { aiService } = await import("./groqAiService");

    await expect(
      aiService.ask({
        action: "identify-image",
        prompt: "Identifique.",
        imageDataUri: "data:image/png;base64,aW1hZ2U=",
      }),
    ).rejects.toThrow(/imagem está temporariamente indisponível/i);
  });

  it("rejects invalid image data before sending a completion", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { aiService } = await import("./groqAiService");

    await expect(
      aiService.ask({
        action: "identify-image",
        prompt: "Identifique",
        imageDataUri: "https://example.test/image.jpg",
      }),
    ).rejects.toThrow(/imagem JPG, PNG ou WebP/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails safely when no API key is configured", async () => {
    delete process.env["GROQ_API_KEY"];
    vi.stubGlobal("fetch", vi.fn());
    const { aiService } = await import("./groqAiService");

    await expect(aiService.ask({ action: "free-text", prompt: "Oi" })).rejects.toThrow(
      /configuração de IA ausente/i,
    );
  });

  it("uses the advanced model as a fallback after a transient primary failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(modelsResponse())
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(completionResponse("Resposta do modelo avançado."));
    vi.stubGlobal("fetch", fetchMock);
    const { aiService } = await import("./groqAiService");

    const result = await aiService.ask({ action: "free-text", prompt: "Uma pergunta." });

    expect(result.text).toBe("Resposta do modelo avançado.");
    expect(result.model).toBe("openai/gpt-oss-120b");
  });

  it("rejects an empty model response rather than inventing an answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(modelsResponse())
        .mockResolvedValueOnce(completionResponse(null)),
    );
    const { aiService } = await import("./groqAiService");

    await expect(aiService.ask({ action: "free-text", prompt: "Uma pergunta." })).rejects.toThrow(
      /resposta válida/i,
    );
  });

  it("recovers when reasoning exhausts the budget before producing visible text", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(modelsResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              { finish_reason: "length", message: { content: null, reasoning: "private" } },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(completionResponse("Compare as notas e a concentração."));
    vi.stubGlobal("fetch", fetchMock);
    const { aiService } = await import("./groqAiService");

    const result = await aiService.ask({ action: "cheapest", prompt: "Compare perfumes." });

    expect(result.text).toBe("Compare as notas e a concentração.");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const first = JSON.parse(fetchMock.mock.calls[1]![1].body);
    const retry = JSON.parse(fetchMock.mock.calls[2]![1].body);
    expect(retry.model).toBe(first.model);
    expect(retry.max_completion_tokens).toBeGreaterThan(first.max_completion_tokens);
  });

  it("stops after one retry if the model still returns only reasoning", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(modelsResponse())
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                { finish_reason: "length", message: { content: "", reasoning: "private" } },
              ],
            }),
          ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { aiService } = await import("./groqAiService");

    await expect(
      aiService.ask({ action: "cheapest", prompt: "Compare perfumes." }),
    ).rejects.toThrow(/resposta válida/i);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
