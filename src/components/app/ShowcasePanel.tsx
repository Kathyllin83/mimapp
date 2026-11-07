import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { brl } from "@/lib/format";
import { storeLabel } from "@/lib/offers";
import { VITRINE_STORES, type VitrineStore } from "@/lib/vitrines";
import { cn } from "@/lib/utils";

interface Item {
  id: number;
  store: VitrineStore;
  title: string;
  image_url: string | null;
  price: number;
  old_price: number | null;
  affiliate_url: string;
}

const EMPTY = { title: "", image_url: "", price: "", old_price: "", affiliate_url: "" };

/** Produtos da vitrine cadastrados à mão: aparecem como cards na aba da loja em /explorar. */
export function ShowcasePanel() {
  const qc = useQueryClient();
  const [store, setStore] = useState<VitrineStore>("amazon");
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; msg?: string }>(
    {
      kind: "idle",
    },
  );

  const items = useQuery({
    queryKey: ["showcase-admin", store],
    queryFn: () => api<Item[]>(`/api/showcase?store=${store}&raw=1`),
    retry: false,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["showcase-admin"] });
    void qc.invalidateQueries({ queryKey: ["showcase"] });
  };
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setState({ kind: "idle" });
  };

  async function save() {
    setState({ kind: "saving" });
    try {
      await api("/api/showcase", {
        method: editing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, store, ...(editing ? { id: editing } : {}) }),
      });
      setForm(EMPTY);
      setEditing(null);
      setState({ kind: "saved" });
      refresh();
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message : "Erro" });
    }
  }
  async function remove(id: number) {
    try {
      await api("/api/showcase", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (editing === id) {
        setEditing(null);
        setForm(EMPTY);
      }
      refresh();
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message : "Erro" });
    }
  }
  function edit(i: Item) {
    setEditing(i.id);
    setForm({
      title: i.title,
      image_url: i.image_url ?? "",
      price: String(i.price).replace(".", ","),
      old_price: i.old_price === null ? "" : String(i.old_price).replace(".", ","),
      affiliate_url: i.affiliate_url,
    });
    setState({ kind: "idle" });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Produtos da vitrine</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Cadastre os produtos da sua vitrine. Eles aparecem como cards na aba da loja em{" "}
        <strong>/explorar</strong>, com o <strong>seu</strong> link no botão. O preço é o que você
        informar aqui (o site mostra a data e avisa que pode mudar na loja), então mantenha-o
        atualizado. A imagem é opcional e deve ser uma URL https.
      </p>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Loja da vitrine">
        {VITRINE_STORES.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={store === s}
            className={cn("filter-chip", store === s && "is-active")}
            onClick={() => {
              setStore(s);
              setEditing(null);
              setForm(EMPTY);
            }}
          >
            {storeLabel(s)}
          </button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <input
          aria-label="Título do produto"
          placeholder="Título do produto"
          className="rounded-full border px-3 py-2 text-xs md:col-span-2"
          value={form.title}
          onChange={set("title")}
        />
        <input
          aria-label="Preço"
          inputMode="decimal"
          placeholder="Preço (ex.: 89,90)"
          className="rounded-full border px-3 py-2 text-xs"
          value={form.price}
          onChange={set("price")}
        />
        <input
          aria-label="Preço anterior"
          inputMode="decimal"
          placeholder="Preço anterior (opcional)"
          className="rounded-full border px-3 py-2 text-xs"
          value={form.old_price}
          onChange={set("old_price")}
        />
        <input
          aria-label="URL da imagem"
          placeholder="URL da imagem https (opcional)"
          className="rounded-full border px-3 py-2 text-xs md:col-span-2"
          value={form.image_url}
          onChange={set("image_url")}
        />
        <input
          aria-label={`Seu link de afiliado ${storeLabel(store)}`}
          placeholder={`Seu link de afiliado ${storeLabel(store)} (https)`}
          className="rounded-full border px-3 py-2 text-xs md:col-span-2"
          value={form.affiliate_url}
          onChange={set("affiliate_url")}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="filter-chip is-active"
          disabled={
            state.kind === "saving" ||
            !form.title.trim() ||
            !form.price.trim() ||
            !form.affiliate_url.trim()
          }
          onClick={() => void save()}
        >
          {editing ? "Salvar alterações" : "Adicionar à vitrine"}
        </button>
        {editing && (
          <button
            className="filter-chip"
            onClick={() => {
              setEditing(null);
              setForm(EMPTY);
            }}
          >
            Cancelar edição
          </button>
        )}
        {state.kind === "saved" && <span className="text-xs text-success">Salvo.</span>}
        {state.kind === "error" && (
          <span role="alert" className="text-xs text-destructive">
            {state.msg}
          </span>
        )}
      </div>

      {items.isPending ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.isError ? (
        <p className="text-sm text-muted-foreground">
          Entre como administrador para gerenciar a vitrine.
        </p>
      ) : items.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum produto na vitrine {storeLabel(store)}.
        </p>
      ) : (
        <ul>
          {items.data.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 border-b py-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-white">
                {i.image_url && (
                  <img
                    src={i.image_url}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{i.title}</p>
                <p className="text-xs text-muted-foreground">
                  {brl(i.price)}
                  {i.old_price !== null && <> · antes {brl(i.old_price)}</>}
                </p>
              </div>
              <button className="filter-chip" onClick={() => edit(i)}>
                Editar
              </button>
              <button className="filter-chip" onClick={() => void remove(i.id)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
