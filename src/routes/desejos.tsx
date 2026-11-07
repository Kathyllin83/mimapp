import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellOff, Check, ExternalLink, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/app/Editorial";
import { CATEGORIES } from "@/lib/catalog";
import { brl } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { CategoryId, WishItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/desejos")({
  head: () => ({
    meta: [
      { title: "Meus Desejos — Mimá" },
      {
        name: "description",
        content: "Sua lista dos sonhos com preço desejado, prioridades e alertas.",
      },
      { property: "og:title", content: "Meus Desejos — Mimá" },
      {
        property: "og:description",
        content: "Organize desejos, defina preços-alvo e veja quanto pode economizar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Wishlist,
});

type View = "all" | "priority" | "alert";

function Wishlist() {
  const { wishlist, set } = useStore();
  const [view, setView] = useState<View>("all");
  const [cat, setCat] = useState<CategoryId | "all">("all");

  const total = wishlist.reduce((s, w) => s + w.currentPrice, 0);
  const target = wishlist.reduce((s, w) => s + Math.min(w.targetPrice, w.currentPrice), 0);
  const saving = Math.max(0, total - target);
  const reached = wishlist.filter(
    (w) => w.currentPrice > 0 && w.currentPrice <= w.targetPrice,
  ).length;
  const usedCats = CATEGORIES.filter((c) => wishlist.some((w) => w.category === c.id));

  const items = wishlist
    .filter((w) => (view === "priority" ? w.priority : view === "alert" ? w.alert : true))
    .filter((w) => cat === "all" || w.category === cat)
    .sort((a, b) => Number(b.priority) - Number(a.priority));

  const update = (id: string, patch: Partial<WishItem>) =>
    set((s) => ({ wishlist: s.wishlist.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));

  const toggleAlert = (w: WishItem) => {
    update(w.id, { alert: !w.alert });
    toast.success(w.alert ? "Alerta desativado" : "Alerta ativado");
  };

  return (
    <div className="pb-6">
      <PageHeader
        title="Desejos que merecem esperar."
        subtitle={`${wishlist.length} ${wishlist.length === 1 ? "desejo salvo" : "desejos salvos"}`}
        right={<AddItem />}
      />
      {wishlist.length > 0 && (
        <>
          <section className="wish-summary">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                O prazer de comprar no seu tempo
              </p>
            </div>
            <p className="wish-saving">
              {brl(saving)}
              <span> de economia possível</span>
            </p>
            <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${total ? Math.round((target / total) * 100) : 0}%` }}
              />
            </div>
            <dl className="mt-4 grid grid-cols-3 divide-x divide-border text-center">
              <Metric label="Total hoje" value={brl(total)} />
              <Metric label="Nos alvos" value={brl(target)} />
              <Metric label="Alvo atingido" value={`${reached}/${wishlist.length}`} />
            </dl>
          </section>
          <div className="mt-6 px-5 md:px-6">
            <div className="wish-tabs">
              {(
                [
                  ["all", "Todos"],
                  ["priority", "Prioridade"],
                  ["alert", "Com alerta"],
                ] as [View, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  className={cn(
                    "rounded-full py-2 transition",
                    view === id
                      ? "bg-card font-semibold text-foreground shadow-soft"
                      : "text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {usedCats.length > 1 && (
            <div className="no-scrollbar mt-3 flex gap-5 overflow-x-auto border-b px-5 md:px-6">
              {[{ id: "all", label: "Todas" }, ...usedCats].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id as CategoryId | "all")}
                  className={cn(
                    "-mb-px shrink-0 border-b-2 py-2.5 text-[13px] transition",
                    cat === c.id
                      ? "border-primary font-semibold text-primary"
                      : "border-transparent text-muted-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {/* Lista */}
      <div className="wish-list">
        {items.length === 0 && (
          <EmptyState
            title="Dê espaço ao seu próximo desejo"
            description="Adicione algo que você adora e escolha quanto quer pagar. Sua lista começa no seu tempo."
          />
        )}
        {items.map((w) => (
          <WishCard
            key={w.id}
            item={w}
            onPriority={() => update(w.id, { priority: !w.priority })}
            onAlert={() => toggleAlert(w)}
            onRemove={() => {
              set((s) => ({ wishlist: s.wishlist.filter((x) => x.id !== w.id) }));
              toast("Removido dos desejos");
            }}
            onTarget={(v) => update(w.id, { targetPrice: v })}
          />
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-1">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-semibold">{value}</dd>
    </div>
  );
}

function WishCard({
  item: w,
  onPriority,
  onAlert,
  onRemove,
  onTarget,
}: {
  item: WishItem;
  onPriority: () => void;
  onAlert: () => void;
  onRemove: () => void;
  onTarget: (v: number) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const photo = w.image;
  const atTarget = w.currentPrice > 0 && w.currentPrice <= w.targetPrice;
  const gap = Math.max(0, w.currentPrice - w.targetPrice);
  const pct = w.currentPrice
    ? Math.min(100, Math.round((w.targetPrice / w.currentPrice) * 100))
    : 0;
  const catLabel = CATEGORIES.find((c) => c.id === w.category)?.label;
  let host = "";
  try {
    host = w.url ? new URL(w.url).hostname.replace(/^www\./, "") : "";
  } catch {
    host = "";
  }

  return (
    <article
      className={cn("wish-card", atTarget && "at-target", removing && "is-removing")}
      onAnimationEnd={() => {
        if (removing) onRemove();
      }}
    >
      <div className="wish-product">
        {photo ? (
          <img className="wish-photo" src={photo} alt={w.name} loading="lazy" />
        ) : (
          <div className="wish-photo wish-monogram" aria-hidden="true">
            m.
          </div>
        )}
        <div className="wish-product-info">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>{catLabel}</span>
              {w.priority && <span className="text-primary">· Prioridade</span>}
            </div>
            <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug">{w.name}</h3>
            {host && (
              <a
                href={w.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary"
              >
                {host}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )}
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              atTarget ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground",
            )}
          >
            {atTarget ? (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                No alvo
              </span>
            ) : (
              `Faltam ${brl(gap)}`
            )}
          </span>
        </div>
      </div>
      {/* Preços */}
      <div className="wish-prices">
        <div className="bg-card px-4 py-3">
          <p className="text-[11px] text-muted-foreground">Preço atual</p>
          <p className="mt-0.5 text-[17px] font-semibold tabular-nums">{brl(w.currentPrice)}</p>
        </div>
        <label className="block bg-card px-4 py-3">
          <span className="text-[11px] text-muted-foreground">Quero pagar</span>
          <span className="mt-0.5 flex items-baseline gap-1 text-[17px] font-semibold text-primary">
            <span className="text-[13px]">R$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={w.targetPrice}
              onChange={(e) => onTarget(Math.max(0, Number(e.target.value) || 0))}
              className="w-full min-w-0 bg-transparent tabular-nums outline-none focus:underline"
              aria-label={`Preço desejado para ${w.name}`}
            />
          </span>
        </label>
      </div>

      <div className="px-4 pt-3">
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              atTarget ? "bg-success" : "bg-primary",
            )}
            style={{ width: `${atTarget ? 100 : pct}%` }}
          />
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 px-2 py-2">
        <ActionBtn
          label={w.priority ? "Remover prioridade" : "Marcar prioridade"}
          active={w.priority}
          onClick={onPriority}
        >
          <Star className={cn("h-4 w-4", w.priority && "fill-primary text-primary")} />
        </ActionBtn>
        <ActionBtn
          label={w.alert ? "Desativar alerta" : "Ativar alerta"}
          active={w.alert}
          onClick={onAlert}
        >
          {w.alert ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
          <span className="text-xs">{w.alert ? "Alerta ativo" : "Alertar"}</span>
        </ActionBtn>
        <div className="flex-1" />
        <ActionBtn label="Remover" onClick={() => setRemoving(true)}>
          <Trash2 className="h-4 w-4" />
        </ActionBtn>
      </div>
    </article>
  );
}

function ActionBtn({
  children,
  onClick,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 transition active:scale-95",
        active ? "text-primary" : "text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function AddItem() {
  const { set } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    url: "",
    category: "perfumaria" as CategoryId,
    currentPrice: "",
    targetPrice: "",
  });

  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    let url = f.url.trim();
    if (url && !/^https?:\/\//.test(url)) url = "https://" + url;
    try {
      if (url) new URL(url);
    } catch {
      toast.error("Link inválido");
      return;
    }
    if (!f.name.trim() && !url) {
      toast.error("Informe um nome ou link");
      return;
    }
    let image: string | undefined;
    let title: string | undefined;
    if (url) {
      setLoading(true);
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        if (res.ok) ({ image, title } = (await res.json()) as { image?: string; title?: string });
      } catch {
        /* sem preview: segue só com o link */
      }
      setLoading(false);
    }
    const name = f.name.trim() || title || "Produto de " + new URL(url).hostname;
    const item: WishItem = {
      id: crypto.randomUUID(),
      name: name.slice(0, 120),
      url: url || undefined,
      ...(image ? { image } : {}),
      category: f.category,
      currentPrice: Number(f.currentPrice) || 0,
      targetPrice: Number(f.targetPrice) || 0,
      priority: false,
      alert: false,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ wishlist: [item, ...s.wishlist] }));
    setOpen(false);
    setF({ name: "", url: "", category: "perfumaria", currentPrice: "", targetPrice: "" });
    toast.success("Adicionado aos desejos");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 shrink-0 gap-1.5 rounded-full px-4 text-[13px] font-semibold">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-xl" aria-describedby="wish-description">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Novo desejo</DialogTitle>
        </DialogHeader>
        <p id="wish-description" className="text-sm text-muted-foreground">
          Guarde um produto e defina seu preço desejado.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Colar link do produto</Label>
            <Input
              value={f.url}
              onChange={(e) => setF({ ...f, url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label>Nome</Label>
            <Input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              maxLength={120}
            />
          </div>
          <div>
            <Label>Categoria</Label>
            <select
              value={f.category}
              onChange={(e) => setF({ ...f, category: e.target.value as CategoryId })}
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Preço atual</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={f.currentPrice}
                onChange={(e) => setF({ ...f, currentPrice: e.target.value })}
              />
            </div>
            <div>
              <Label>Quero pagar</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={f.targetPrice}
                onChange={(e) => setF({ ...f, targetPrice: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-full">
            {loading ? "Buscando imagem…" : "Adicionar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
