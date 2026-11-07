import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Camera, Gem, Heart, LoaderCircle, Scale, Tag, Wallet, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import mascot from "@/assets/mascote.png";
import { AssistantAnswer } from "@/components/app/AssistantAnswer";
import { cn } from "@/lib/utils";
import { remainingAi } from "@/lib/plans";
import type { AiAction } from "@/services/contracts";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/assistente")({
  head: () => ({ meta: [{ title: "Sua assistente pessoal — Mimá" }] }),
  component: Assistant,
});
type Message = { role: "user" | "assistant"; text: string; image?: string };

const PLACEHOLDERS: Record<AiAction, string> = {
  cheapest: "Qual perfume você quer pelo menor preço?",
  "compare-perfumes": "Quais perfumes comparamos?",
  dupes: "De qual perfume você quer um dupe?",
  "budget-alternatives": "Qual é o seu orçamento e o que procura?",
  "analyze-wishlist": "Escreva sua mensagem…",
  "identify-image": "Escreva sua mensagem…",
  "free-text": "Escreva sua mensagem…",
};

function Assistant() {
  const { user, plan, aiUsed, wishlist } = useStore();
  const [action, setAction] = useState<AiAction>("free-text");
  const [prompt, setPrompt] = useState("");
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const queriesLeft = remaining ?? remainingAi(plan, aiUsed);
  const started = messages.length > 0 || loading;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  function pick(next: AiAction) {
    setAction(next);
    setError("");
    if (next === "analyze-wishlist")
      setPrompt(
        wishlist.length
          ? `Analise meus desejos: ${wishlist.map((w) => w.name).join(", ")}.`
          : "Ainda não tenho desejos salvos. Como devo começar?",
      );
    inputRef.current?.focus();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!user) {
      setError("Entre na sua conta para conversar com a assistente.");
      return;
    }
    const text = prompt.trim();
    if (!text && !imageDataUri) return;
    const sentImage = imageDataUri;
    setMessages((m) => [
      ...m,
      {
        role: "user",
        text: text || "Identifique este produto.",
        ...(sentImage ? { image: sentImage } : {}),
      },
    ]);
    setPrompt("");
    setImageDataUri(null);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: sentImage ? "identify-image" : action,
          prompt: text || "Identifique o produto visível e indique qualquer incerteza.",
          ...(sentImage ? { imageDataUri: sentImage } : {}),
        }),
      });
      const data = (await response.json()) as {
        text?: string;
        error?: string;
        remaining?: number;
      };
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir a consulta.");
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.text || "A assistente não retornou uma resposta." },
      ]);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function selectImage(file?: File) {
    setError("");
    if (!file) return;
    if (!"image/jpeg,image/png,image/webp".split(",").includes(file.type)) {
      setError("Escolha uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter até 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageDataUri(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setError("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="mima-chat">
      <header className="mima-chat-header">
        <img src={mascot} alt="" width={48} height={48} className="mima-chat-avatar" />
        <div className="mima-chat-id">
          <strong>Assistente Mimá</strong>
          <span>
            <i aria-hidden="true" /> Online agora
          </span>
        </div>
        <span className="mima-chat-quota" aria-label={`${queriesLeft} consultas restantes`}>
          <Gem size={15} strokeWidth={1.6} /> {queriesLeft}{" "}
          {queriesLeft === 1 ? "consulta" : "consultas"}
        </span>
      </header>

      <div className="mima-chat-body" aria-live="polite">
        {!started && (
          <section className="mima-chat-welcome">
            <div className="mima-chat-mascot">
              <img src={mascot} alt="" />
            </div>
            <h1>
              Oi, eu sou a <em>Mimá</em>
            </h1>
            <p>
              Me conta o que você procura — um perfume, um dupe, o menor preço — e eu te ajudo a
              escolher.
            </p>
            <p className="mima-chat-script">por onde a gente começa? ↴</p>
            <div className="mima-chat-choices">
              <button
                type="button"
                className={cn("choice choice-price", action === "cheapest" && "is-active")}
                aria-pressed={action === "cheapest"}
                onClick={() => pick("cheapest")}
              >
                <Tag size={16} strokeWidth={1.6} aria-hidden="true" />
                <strong>Menor preço</strong>
                <span>eu caço a oferta pra você</span>
              </button>
              <button
                type="button"
                className={cn("choice choice-dupe", action === "dupes" && "is-active")}
                aria-pressed={action === "dupes"}
                onClick={() => pick("dupes")}
              >
                <strong>Descobrir dupe</strong>
                <span>mesmo cheiro, outro preço</span>
              </button>
              <button
                type="button"
                className={cn(
                  "choice choice-compare",
                  action === "compare-perfumes" && "is-active",
                )}
                aria-pressed={action === "compare-perfumes"}
                onClick={() => pick("compare-perfumes")}
              >
                <Scale size={17} strokeWidth={1.6} aria-hidden="true" /> Comparar perfumes
              </button>
              <button
                type="button"
                className={cn(
                  "choice choice-budget",
                  action === "budget-alternatives" && "is-active",
                )}
                aria-pressed={action === "budget-alternatives"}
                onClick={() => pick("budget-alternatives")}
              >
                <Wallet size={16} strokeWidth={1.6} aria-hidden="true" /> No meu orçamento
              </button>
              <button
                type="button"
                className={cn("choice choice-wish", action === "analyze-wishlist" && "is-active")}
                aria-pressed={action === "analyze-wishlist"}
                onClick={() => pick("analyze-wishlist")}
              >
                <Heart size={16} strokeWidth={1.8} aria-hidden="true" /> Meus desejos
              </button>
            </div>
          </section>
        )}

        {messages.map((message, index) => (
          <div key={index} className={cn("mima-msg", `mima-msg-${message.role}`)}>
            {message.image && <img src={message.image} alt="Foto enviada" />}
            {message.role === "assistant" ? (
              <AssistantAnswer text={message.text} />
            ) : (
              <p>{message.text}</p>
            )}
          </div>
        ))}
        {loading && (
          <div className="mima-msg mima-msg-assistant" role="status">
            <LoaderCircle className="animate-spin" size={16} /> Mimá está pensando…
          </div>
        )}
        {error && (
          <p className="mima-chat-error" role="alert">
            {error}
          </p>
        )}
        {!user && !error && (
          <p className="mima-chat-error" role="note">
            Entre na sua conta para enviar uma consulta.
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form className="mima-composer" onSubmit={submit}>
        {imageDataUri && (
          <div className="mima-composer-preview">
            <img src={imageDataUri} alt="Prévia do produto enviado" />
            <button type="button" aria-label="Remover imagem" onClick={() => setImageDataUri(null)}>
              <X size={14} />
            </button>
          </div>
        )}
        <div className="mima-composer-row">
          <label className="mima-composer-photo" aria-label="Enviar foto do produto">
            <Camera size={21} strokeWidth={1.6} />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                selectImage(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
              disabled={loading}
            />
          </label>
          <input
            ref={inputRef}
            type="text"
            aria-label="Sua mensagem para a assistente"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={PLACEHOLDERS[action]}
            maxLength={3000}
            enterKeyHint="send"
            autoComplete="off"
            disabled={loading}
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={loading || (!prompt.trim() && !imageDataUri)}
          >
            {loading ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowUp size={20} />}
          </button>
        </div>
      </form>
    </div>
  );
}
