import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import mascot from "@/assets/mascote.png";
import { BrandLogo } from "@/components/app/BrandLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Mimá" },
      { name: "description", content: "Entre ou crie sua conta Mimá." },
      { property: "og:title", content: "Entrar — Mimá" },
      { property: "og:description", content: "Acesse sua lista de desejos e alertas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  const { set } = useStore();
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(f.email)) {
      toast.error("E-mail inválido");
      return;
    }
    if (f.password.length < 6) {
      toast.error("Senha com no mínimo 6 caracteres");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: mode === "in" ? "login" : "register",
          name: f.name,
          email: f.email,
          password: f.password,
        }),
      });
      const data = (await response.json()) as {
        user?: { name: string; email: string };
        error?: string;
      };
      if (!response.ok || !data.user) {
        toast.error(data.error ?? "Não foi possível entrar");
        return;
      }
      set({ user: data.user });
      toast.success(mode === "in" ? "Boas-vindas de volta" : "Conta criada com sucesso");
      nav({ to: "/perfil" });
    } catch {
      toast.error("Não foi possível conectar. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="auth-page">
      <aside className="auth-story" aria-label="Mimá">
        <Link to="/" className="auth-brand" aria-label="Mimá — início">
          <BrandLogo variant="clara" />
        </Link>
        <div className="auth-story-copy">
          <p className="auth-eyebrow">O prazer de se descobrir</p>
          <h1>
            Seus desejos.
            <br />
            <em>Do seu jeito.</em>
          </h1>
          <p>
            Um lugar só seu para guardar ideias, acompanhar escolhas e encontrar o que combina com
            você.
          </p>
        </div>
        <div className="auth-mascot" aria-hidden="true">
          <img src={mascot} alt="" />
        </div>
        <p className="auth-story-signature">PERFUMARIA · BELEZA · DESCOBERTAS</p>
      </aside>

      <section className="auth-main">
        <Link to="/" className="auth-back">
          <ArrowLeft size={16} /> Voltar à MIMÁ
        </Link>
        <div className="auth-panel">
          <p className="eyebrow">{mode === "in" ? "Que bom ter você aqui" : "Um novo começo"}</p>
          <h2>{mode === "in" ? "Entre na sua conta." : "Crie seu espaço."}</h2>
          <p className="auth-subtitle">
            {mode === "in"
              ? "Acesse seus desejos e continue de onde parou."
              : "Seus favoritos e descobertas começam aqui."}
          </p>

          <div className="auth-switch" role="tablist" aria-label="Acesso à conta">
            {(["in", "up"] as const).map((nextMode) => (
              <button
                key={nextMode}
                type="button"
                role="tab"
                aria-selected={mode === nextMode}
                onClick={() => setMode(nextMode)}
              >
                {nextMode === "in" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="auth-form">
            {mode === "up" && (
              <div className="auth-field">
                <Label htmlFor="auth-name">Seu nome</Label>
                <Input
                  id="auth-name"
                  autoComplete="name"
                  value={f.name}
                  maxLength={60}
                  required
                  placeholder="Como podemos chamar você?"
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                />
              </div>
            )}
            <div className="auth-field">
              <Label htmlFor="auth-email">E-mail</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={f.email}
                required
                placeholder="voce@exemplo.com"
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
            </div>
            <div className="auth-field">
              <Label htmlFor="auth-password">Senha</Label>
              <div className="auth-password-wrap">
                <Input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "in" ? "current-password" : "new-password"}
                  value={f.password}
                  minLength={6}
                  required
                  placeholder="Pelo menos 6 caracteres"
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {mode === "up" && (
                <span className="auth-field-hint">Use no mínimo 6 caracteres.</span>
              )}
            </div>
            <button className="auth-submit" type="submit" disabled={pending}>
              {pending ? "Aguarde…" : mode === "in" ? "Entrar na minha conta" : "Criar minha conta"}
              {pending ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <ArrowRight size={18} />
              )}
            </button>
          </form>
          <p className="auth-footnote">
            {mode === "in" ? "Ainda não tem uma conta?" : "Já faz parte da MIMÁ?"}{" "}
            <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </div>
        <p className="auth-copyright">© MIMÁ · ESCOLHAS COM A SUA CARA</p>
      </section>
    </main>
  );
}
