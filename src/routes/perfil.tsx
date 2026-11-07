import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, LogOut, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/app/AppShell";
import { Switch } from "@/components/ui/switch";
import { CATEGORIES } from "@/lib/catalog";

import { useStore } from "@/lib/store";
import type { CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Mimá" },
      { name: "description", content: "Seus dados, preferências, plano e notificações." },
      { property: "og:title", content: "Perfil — Mimá" },
      { property: "og:description", content: "Gerencie sua conta Mimá." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Profile,
});

const PREF_LABELS: Record<string, string> = {
  queda: "Queda de preço",
  alvo: "Preço desejado atingido",
  oferta: "Novas ofertas relevantes",
  favorito: "Favoritos em promoção",
  limite: "Limite de consultas",
};

function Profile() {
  const s = useStore();
  const toggleCat = (c: CategoryId) =>
    s.set((st) => ({
      favCategories: st.favCategories.includes(c)
        ? st.favCategories.filter((x) => x !== c)
        : [...st.favCategories, c],
    }));

  return (
    <div className="profile-page pb-4">
      <PageHeader
        title="Seu gosto. Seu universo."
        subtitle="Um espaço para tudo que faz sentido para você."
      />
      <div className="profile-layout">
        <div className="profile-identity-column">
          {/* Identidade do usuário */}
          {s.user ? (
            <div className="profile-identity">
              <span className="profile-avatar">{s.user.name[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-semibold leading-tight">{s.user.name}</p>
                <p className="truncate text-[13px] text-muted-foreground">{s.user.email}</p>
              </div>
            </div>
          ) : (
            <div className="profile-welcome">
              <p className="font-display text-lg font-semibold leading-snug">Sua conta Mimá</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Seus interesses e pequenos desejos, reunidos em um lugar só. Entre para acessar sua
                conta.
              </p>
              <Link
                to="/entrar"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition active:scale-[0.98]"
              >
                Entrar ou criar conta
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          <div className="profile-plan">
            <div>
              <span className="eyebrow">Planos</span>
              <p className="mt-2 text-sm text-muted-foreground">
                Informações de planos ainda não disponíveis.
              </p>
            </div>
          </div>
          <div className="profile-stats">
            <Link to="/desejos">
              <strong>{s.wishlist.length.toString().padStart(2, "0")}</strong>
              <span>Desejos</span>
            </Link>
            <a href="#saved-products">
              <strong>{s.favorites.length.toString().padStart(2, "0")}</strong>
              <span>Favoritos</span>
            </a>
          </div>
          <div className="profile-note">
            <span className="eyebrow">Escolhas com intenção</span>
            <p>Seu próximo achado começa com aquilo que você ama.</p>
          </div>
        </div>
        <div className="profile-settings-column">
          {/* Categorias favoritas */}
          <Section title="Seus interesses" hint="Toque para ajustar">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = s.favCategories.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCat(c.id)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-3.5 py-3 text-[13px] font-medium transition-all duration-200 active:scale-95",
                      on
                        ? "border-primary/25 bg-blush font-semibold text-primary"
                        : "border-border bg-transparent text-muted-foreground hover:border-primary/20 hover:text-foreground",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <div id="saved-products" />
          {/* Produtos salvos — lista editorial */}
          <Section title="Produtos salvos">
            <p className="text-[13px] text-muted-foreground">
              Os produtos salvos aparecerão aqui quando o catálogo estiver disponível.
            </p>
          </Section>

          {/* Notificações */}
          <Section title="Notificações">
            <div className="divide-y divide-border">
              {Object.entries(PREF_LABELS).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between py-3.5 text-sm">
                  {label}
                  <Switch
                    checked={!!s.notifPrefs[k]}
                    onCheckedChange={(v) =>
                      s.set((st) => ({ notifPrefs: { ...st.notifPrefs, [k]: v } }))
                    }
                  />
                </label>
              ))}
            </div>
          </Section>

          {/* Privacidade e conta */}
          <Section title="Privacidade">
            <div className="divide-y divide-border">
              <Link to="/notificacoes" className="flex items-center justify-between py-3.5 text-sm">
                Histórico de alertas
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <div className="flex items-center gap-2.5 py-3.5 text-[13px] text-muted-foreground">
                <Shield className="h-4 w-4 shrink-0" />
                Seus dados ficam apenas neste aparelho nesta versão.
              </div>
              {s.user && (
                <button
                  onClick={() => {
                    void fetch("/api/auth", { method: "DELETE", credentials: "include" });
                    s.set({ user: null });
                    toast("Você saiu");
                  }}
                  className="flex w-full items-center gap-2.5 py-3.5 text-sm"
                >
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                  Sair
                </button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex w-full items-center gap-2.5 py-3.5 text-sm text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Excluir conta e dados
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Todos os desejos, favoritos e preferências serão apagados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        s.reset();
                        toast("Dados excluídos");
                      }}
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Section>
        </div>
      </div>
      <div className="px-5 pt-8 text-center md:px-6">
        <Link to="/admin" className="text-xs text-muted-foreground underline underline-offset-2">
          Painel administrativo
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="profile-section">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        {action ??
          (hint && (
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {hint}
            </span>
          ))}
      </div>
      {children}
    </section>
  );
}
