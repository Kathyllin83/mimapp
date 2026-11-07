import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { ShowcasePanel } from "@/components/app/ShowcasePanel";
import { VitrinePanel } from "@/components/app/VitrinePanel";
import { ApiError, api } from "@/lib/api";
import { brl } from "@/lib/format";
import { OFFER_STORES, storeLabel } from "@/lib/offers";
import { cn } from "@/lib/utils";

interface AdminOffer {
  id: number;
  title: string;
  image_url: string | null;
  marketplace: string;
  price: number;
  score: number;
  store_url: string | null;
  affiliate_url: string | null;
}
interface AdminList {
  data: AdminOffer[];
  total: number;
  current_page: number;
  last_page: number;
}
interface ImportReport {
  saved: number;
  skipped: number;
  errors: { line: number; error: string }[];
}

export function AffiliatePanel() {
  const qc = useQueryClient();
  const [store, setStore] = useState<string>("all");
  const [onlyWithout, setOnlyWithout] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const params = new URLSearchParams({ page: String(page), per_page: "30" });
  if (store !== "all") params.set("marketplace", store);
  if (onlyWithout) params.set("only_without_link", "1");
  if (q.trim()) params.set("q", q.trim());
  const list = useQuery({
    queryKey: ["admin-affiliate", params.toString()],
    queryFn: () => api<AdminList>(`/api/admin/affiliate?${params}`),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-affiliate"] });

  async function importFile(f: File) {
    setReport(null);
    setImportError(null);
    try {
      const text = await f.text();
      setReport(
        await api<ImportReport>("/api/admin/affiliate/csv", {
          method: "POST",
          headers: { "content-type": "text/csv" },
          body: text,
        }),
      );
      void refresh();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Falha ao importar");
    }
  }

  if (list.error instanceof ApiError && [401, 403].includes(list.error.status)) {
    return (
      <p className="text-sm text-muted-foreground">
        {list.error.status === 401
          ? "Entre com uma conta de administrador para cadastrar links."
          : "Esta área é restrita a administradores."}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <VitrinePanel />
      <ShowcasePanel />
      <h2 className="text-lg font-semibold">Links de afiliado dos produtos</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Cole o <strong>seu</strong> link de afiliado em cada oferta. O sistema só confere o domínio
        e se o link é da mesma loja; ele não altera o link nem garante comissão. Sem link, a oferta
        aparece sem o botão de compra (ou com a URL limpa do produto, quando existe).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <a className="filter-chip inline-flex items-center gap-2" href="/api/admin/affiliate/csv">
          <Download size={14} /> Baixar planilha (sem link)
        </a>
        <a
          className="filter-chip inline-flex items-center gap-2"
          href="/api/admin/affiliate/csv?all=1"
        >
          <Download size={14} /> Baixar todas
        </a>
        <button
          className="filter-chip inline-flex items-center gap-2"
          onClick={() => file.current?.click()}
        >
          <Upload size={14} /> Importar planilha
        </button>
        <input
          ref={file}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {importError && (
        <p role="alert" className="text-sm text-destructive">
          {importError}
        </p>
      )}
      {report && (
        <div role="status" className="rounded-xl border p-3 text-sm">
          <p>
            Salvos: <strong>{report.saved}</strong> · sem link (ignorados): {report.skipped} · com
            erro: {report.errors.length}
          </p>
          {report.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-destructive">
              {report.errors.slice(0, 20).map((e) => (
                <li key={`${e.line}-${e.error}`}>
                  linha {e.line}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Loja">
        {[{ slug: "all", label: "Todas" }, ...OFFER_STORES].map((s) => (
          <button
            key={s.slug}
            role="tab"
            aria-selected={store === s.slug}
            className={cn("filter-chip", store === s.slug && "is-active")}
            onClick={() => {
              setStore(s.slug);
              setPage(1);
            }}
          >
            {s.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={onlyWithout}
            onChange={(e) => {
              setOnlyWithout(e.target.checked);
              setPage(1);
            }}
          />
          Só sem link
        </label>
        <input
          aria-label="Buscar oferta"
          placeholder="Buscar pelo título"
          className="rounded-full border px-3 py-2 text-xs"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {list.isPending ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : list.isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar as ofertas.</p>
      ) : list.data.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma oferta nesse filtro.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{list.data.total} ofertas</p>
          <ul>
            {list.data.data.map((o) => (
              <AffiliateRow key={o.id} offer={o} onChanged={refresh} />
            ))}
          </ul>
          {list.data.last_page > 1 && (
            <nav className="flex items-center gap-3 text-xs" aria-label="Paginação">
              <button
                className="filter-chip"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </button>
              <span>
                Página {list.data.current_page} de {list.data.last_page}
              </span>
              <button
                className="filter-chip"
                disabled={page >= list.data.last_page}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function AffiliateRow({ offer, onChanged }: { offer: AdminOffer; onChanged: () => unknown }) {
  const [url, setUrl] = useState(offer.affiliate_url ?? "");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; msg?: string }>(
    {
      kind: "idle",
    },
  );

  async function save() {
    setState({ kind: "saving" });
    try {
      await api("/api/admin/affiliate", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerId: offer.id, url }),
      });
      setState({ kind: "saved" });
      void onChanged();
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message : "Erro" });
    }
  }
  async function remove() {
    setState({ kind: "saving" });
    try {
      await api("/api/admin/affiliate", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerId: offer.id }),
      });
      setUrl("");
      setState({ kind: "idle" });
      void onChanged();
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message : "Erro" });
    }
  }

  return (
    <li className="flex flex-wrap items-start gap-3 border-b py-3 md:flex-nowrap">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-white">
        {offer.image_url && (
          <img
            src={offer.image_url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{offer.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          #{offer.id} · {storeLabel(offer.marketplace)} · {brl(offer.price)} · nota {offer.score}
          {offer.store_url && (
            <>
              {" · "}
              <a
                href={offer.store_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline"
              >
                Abrir produto na loja <ExternalLink size={11} />
              </a>
            </>
          )}
        </p>
      </div>
      <div className="flex w-full flex-col gap-1 md:w-[26rem]">
        <div className="flex gap-2">
          <input
            aria-label={`Seu link de afiliado para ${offer.title}`}
            placeholder="https://… (seu link de afiliado)"
            className="min-w-0 flex-1 rounded-full border px-3 py-2 text-xs"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setState({ kind: "idle" });
            }}
            onKeyDown={(e) => e.key === "Enter" && url.trim() && void save()}
          />
          <button
            className="filter-chip is-active"
            disabled={!url.trim() || state.kind === "saving"}
            onClick={() => void save()}
          >
            Salvar
          </button>
          {offer.affiliate_url && (
            <button
              className="filter-chip"
              onClick={() => void remove()}
              disabled={state.kind === "saving"}
            >
              Remover
            </button>
          )}
        </div>
        {state.kind === "saved" && <p className="text-xs text-success">Link salvo.</p>}
        {state.kind === "error" && (
          <p role="alert" className="text-xs text-destructive">
            {state.msg}
          </p>
        )}
      </div>
    </li>
  );
}
