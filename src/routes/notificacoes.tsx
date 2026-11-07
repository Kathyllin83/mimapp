import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Check, Heart, Tag, Target, TrendingDown } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/Editorial";
import { useStore } from "@/lib/store";
import type { NotificationKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notificacoes")({
  head: () => ({ meta: [{ title: "Seus alertas — Mimá" }] }),
  component: Notifications,
});
const ICON: Record<NotificationKind, typeof Tag> = {
  queda: TrendingDown,
  alvo: Target,
  oferta: Tag,
  favorito: Heart,
  limite: AlertTriangle,
};
const LABEL: Record<NotificationKind, string> = {
  queda: "Preço em movimento",
  alvo: "Uma boa notícia",
  oferta: "Para descobrir",
  favorito: "Da sua seleção",
  limite: "Sua conta",
};
function Notifications() {
  const { notifications, set } = useStore();
  const [filter, setFilter] = useState<"all" | "unread" | "prices">("all");
  const unread = notifications.filter((n) => !n.read).length;
  const visible = notifications.filter((n) =>
    filter === "unread" ? !n.read : filter === "prices" ? ["queda", "alvo"].includes(n.kind) : true,
  );
  return (
    <div className="alerts-page">
      <PageHeader
        title="Boas notícias para seus desejos."
        subtitle={`${unread} ${unread === 1 ? "novidade esperando" : "novidades esperando"} por você`}
      />
      <div className="alerts-toolbar">
        <div className="alert-filters">
          {(
            [
              ["all", "Todos"],
              ["unread", "Não lidos"],
              ["prices", "Preços"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cn(filter === id && "is-active")}
            >
              {label}
              {id === "unread" && <span>{unread}</span>}
            </button>
          ))}
        </div>
        <button
          className="mark-read"
          disabled={!unread}
          onClick={() =>
            set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }))
          }
        >
          <Check size={15} />
          <span>Marcar todos como lidos</span>
        </button>
      </div>
      <div className="alerts-layout">
        <section className="alerts-timeline" aria-label="Seus alertas">
          {visible.length === 0 && (
            <EmptyState
              title="Tudo em dia por aqui"
              description="Você ainda não tem alertas. Eles aparecerão aqui quando houver atualizações para seus desejos."
            />
          )}
          {visible.map((n) => {
            const Icon = ICON[n.kind];
            return (
              <article
                key={n.id}
                className={cn("alert-event", `alert-${n.kind}`, !n.read && "is-unread")}
              >
                <span className="alert-event-icon">
                  <Icon size={21} strokeWidth={1.5} />
                </span>
                <div className="alert-event-content">
                  <div className="alert-eyebrow">
                    <span>{LABEL[n.kind]}</span>
                    {!n.read && <span className="unread-label">Novo</span>}
                  </div>
                  <h2>{n.title}</h2>
                  <p>{n.body}</p>
                  <div className="alert-event-footer">
                    <time dateTime={n.createdAt}>
                      {new Date(n.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        timeZone: "America/Recife",
                      })}
                    </time>
                    {!n.read && (
                      <button
                        onClick={() =>
                          set((s) => ({
                            notifications: s.notifications.map((x) =>
                              x.id === n.id ? { ...x, read: true } : x,
                            ),
                          }))
                        }
                      >
                        Marcar como lido <Check size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
        <aside className="alerts-aside">
          <span className="eyebrow">No seu tempo</span>
          <h2>
            Um desejo.
            <br />O preço certo.
            <br />
            <em>Seu momento.</em>
          </h2>
          <p>Defina quanto quer pagar e organize os alertas da sua lista.</p>
          <Link to="/desejos" className="text-link">
            Cuidar dos meus desejos <ArrowRight size={16} />
          </Link>
          <div className="aside-divider" />
          <p className="price-caption">
            Esta experiência simula alertas. Não há monitoramento de preços nem envio de
            notificações reais.
          </p>
          <Link to="/perfil" className="text-link">
            Ajustar preferências <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
