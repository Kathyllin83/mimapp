import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, Boxes, Cpu, Layers, Link2, Plug, Tag, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AffiliatePanel } from "@/components/app/AffiliatePanel";
import { EmptyState } from "@/components/app/Editorial";
import { CATEGORIES } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { marketplaceServices } from "@/services/marketplaces";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Painel administrativo — Mimá" }, { name: "robots", content: "noindex" }],
  }),
  component: Admin,
});

const TABS = [
  { id: "metrics", label: "Métricas", icon: BarChart3 },
  { id: "users", label: "Usuários", icon: Users },
  { id: "promos", label: "Promoções", icon: Tag },
  { id: "affiliates", label: "Afiliados", icon: Link2 },
  { id: "categories", label: "Categorias", icon: Layers },
  { id: "plans", label: "Planos", icon: Boxes },
  { id: "ai", label: "Assistente", icon: Cpu },
  { id: "integrations", label: "Integrações", icon: Plug },
] as const;
type Tab = (typeof TABS)[number]["id"];

function Admin() {
  const [tab, setTab] = useState<Tab>("metrics");
  const [aiConnected, setAiConnected] = useState(false);
  useEffect(() => {
    fetch("/api/ai", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return;
        const status = (await response.json()) as { text?: boolean };
        setAiConnected(status.text === true);
      })
      .catch(() => setAiConnected(false));
  }, []);
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-sidebar p-4 text-sidebar-foreground md:min-h-screen md:w-60">
        <Link to="/" className="mb-4 flex items-center gap-2 text-sm opacity-80">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao app
        </Link>
        <p className="font-display text-xl">Mimá Admin</p>
        <nav
          aria-label="Administração"
          className="no-scrollbar mt-4 flex gap-1 overflow-x-auto md:flex-col"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                tab === id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "opacity-80 hover:opacity-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="min-w-0 flex-1 p-5 md:p-8">
        <h1 className="mb-5 text-2xl font-bold">{TABS.find((t) => t.id === tab)!.label}</h1>
        {tab === "categories" ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <div key={c.id} className="border-b px-2 py-4">
                <span className="text-xs text-muted-foreground">{c.id}</span>
                <p className="mt-1 font-medium">{c.label}</p>
              </div>
            ))}
          </div>
        ) : null}
        {tab === "affiliates" ? <AffiliatePanel /> : null}
        {tab === "integrations" ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ...marketplaceServices.map((s) => ({ name: s.id, connected: s.enabled })),
              { name: "Assistente", connected: aiConnected },
              { name: "Notificações push", connected: false },
              { name: "Afiliados", connected: false },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between border-b p-4">
                <p className="font-medium capitalize">{item.name}</p>
                <span className="text-xs text-muted-foreground">
                  {item.connected ? "Conectada" : "Não conectada"}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {["metrics", "users", "promos", "plans", "ai"].includes(tab) && (
          <EmptyState
            title="Nenhum dado disponível"
            description="Esta área será preenchida quando houver dados conectados."
          />
        )}
      </section>
    </div>
  );
}
