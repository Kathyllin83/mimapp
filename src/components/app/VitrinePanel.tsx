import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { storeLabel } from "@/lib/offers";
import { VITRINE_STORES, isEmbeddable, type Vitrine, type VitrineStore } from "@/lib/vitrines";

/** Cadastro dinâmico da vitrine pública de cada loja (exibida na aba da loja em /explorar). */
export function VitrinePanel() {
  const qc = useQueryClient();
  const vitrines = useQuery({
    queryKey: ["vitrines"],
    queryFn: () => api<Vitrine[]>("/api/vitrines"),
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["vitrines"] });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Vitrines por loja</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Cole o link (https) da sua vitrine pública. Ela aparece dentro da aba da loja em{" "}
        <strong>/explorar</strong>, acima das ofertas do robô. Só Amazon, Mercado Livre e Shopee têm
        vitrine. Links da própria loja (Amazon, Mercado Livre, Shopee) não podem ser exibidos dentro
        de outro site: nesse caso a aba mostra um cartão com botão que abre a vitrine em nova aba.
        Uma página sua (https) que permita ser embutida aparece num quadro.
      </p>
      {vitrines.isPending ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <ul>
          {VITRINE_STORES.map((store) => {
            const current = vitrines.data?.find((v) => v.store === store) ?? null;
            return (
              <VitrineRow
                key={`${store}-${current?.url ?? ""}-${current?.height ?? ""}-${current?.title ?? ""}`}
                store={store}
                current={current}
                onChanged={refresh}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

function VitrineRow({
  store,
  current,
  onChanged,
}: {
  store: VitrineStore;
  current: Vitrine | null;
  onChanged: () => unknown;
}) {
  const [url, setUrl] = useState(current?.url ?? "");
  const [title, setTitle] = useState(current?.title ?? "");
  const [height, setHeight] = useState(String(current?.height ?? 900));
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; msg?: string }>(
    {
      kind: "idle",
    },
  );

  async function run(method: "PUT" | "DELETE") {
    setState({ kind: "saving" });
    try {
      await api("/api/vitrines", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(method === "PUT" ? { store, url, title, height } : { store }),
      });
      setState(method === "PUT" ? { kind: "saved" } : { kind: "idle" });
      if (method === "DELETE") {
        setUrl("");
        setTitle("");
        setHeight("900");
      }
      void onChanged();
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message : "Erro" });
    }
  }

  const label = storeLabel(store);
  return (
    <li className="space-y-2 border-b py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{label}</p>
        <span className="text-xs text-muted-foreground">
          {!current
            ? "Sem vitrine"
            : store === "shopee"
              ? "Não exibida: a aba mostra os produtos cadastrados"
              : isEmbeddable(current.url)
                ? "Ativa (quadro embutido)"
                : "Ativa (cartão com link)"}
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_12rem_6rem]">
        <input
          aria-label={`Link da vitrine ${label}`}
          placeholder="https://… (link da vitrine)"
          className="min-w-0 rounded-full border px-3 py-2 text-xs"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setState({ kind: "idle" });
          }}
        />
        <input
          aria-label={`Título da vitrine ${label}`}
          placeholder="Título (opcional)"
          className="rounded-full border px-3 py-2 text-xs"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          aria-label={`Altura da vitrine ${label} em pixels`}
          inputMode="numeric"
          placeholder="Altura"
          className="rounded-full border px-3 py-2 text-xs"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="filter-chip is-active"
          disabled={!url.trim() || state.kind === "saving"}
          onClick={() => void run("PUT")}
        >
          Salvar
        </button>
        {current && (
          <>
            <button
              className="filter-chip"
              disabled={state.kind === "saving"}
              onClick={() => void run("DELETE")}
            >
              Remover
            </button>
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs underline"
            >
              Abrir vitrine <ExternalLink size={11} />
            </a>
          </>
        )}
        {state.kind === "saved" && <span className="text-xs text-success">Vitrine salva.</span>}
        {state.kind === "error" && (
          <span role="alert" className="text-xs text-destructive">
            {state.msg}
          </span>
        )}
      </div>
    </li>
  );
}
