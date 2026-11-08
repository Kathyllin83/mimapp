import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { BOOKMARKLET_HREF, parseProductPaste } from "@/lib/bookmarklet";
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
  source_url: string | null;
}

interface ImportReport {
  created: number;
  updated: number;
  errors: { line: number; error: string }[];
}

const EMPTY = { title: "", image_url: "", price: "", old_price: "", affiliate_url: "" };

/** Produtos da vitrine cadastrados à mão: aparecem como cards na aba da loja em /explorar. */
export function ShowcasePanel() {
  const qc = useQueryClient();
  const [store, setStore] = useState<VitrineStore>("amazon");
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; msg?: string }>(
    { kind: "idle" },
  );
  const [paste, setPaste] = useState("");
  const [pasteMsg, setPasteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [shopeeLink, setShopeeLink] = useState("");
  const [shopeeMsg, setShopeeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [shopeeBusy, setShopeeBusy] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const shopeeStatus = useQuery({
    queryKey: ["shopee-status"],
    queryFn: () => api<{ configured: boolean }>("/api/admin/shopee"),
    retry: false,
  });
  const [importError, setImportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const file = useRef<HTMLInputElement>(null);

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

  function applyPaste(text: string) {
    setPaste(text);
    if (!text.trim()) {
      setPasteMsg(null);
      return;
    }
    const p = parseProductPaste(text);
    if (!p) {
      setPasteMsg({
        ok: false,
        text: "Não reconheci esse texto. Clique no favorito na página do produto e cole o que ele copiou.",
      });
      return;
    }
    if (p.store) {
      setStore(p.store);
      setEditing(null);
    }
    setForm((f) => ({
      ...f,
      title: p.title,
      price: p.price,
      old_price: p.old_price,
      image_url: p.image_url,
    }));
    setState({ kind: "idle" });
    setPasteMsg({
      ok: true,
      text: `Preenchido: ${p.title}${p.price ? ` · R$ ${p.price}` : " · preço não encontrado, digite-o"}. Agora cole o seu link de afiliado e salve.`,
    });
    setPaste("");
  }

  async function save() {
    setState({ kind: "saving" });
    try {
      await api("/api/showcase", {
        method: editing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          store,
          source_url: sourceUrl,
          ...(editing ? { id: editing } : {}),
        }),
      });
      setForm(EMPTY);
      setSourceUrl("");
      setEditing(null);
      setPasteMsg(null);
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
        setSourceUrl("");
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
    setSourceUrl(i.source_url ?? "");
    setState({ kind: "idle" });
  }
  async function importShopee() {
    setShopeeBusy(true);
    setShopeeMsg(null);
    try {
      const p = await api<{
        title: string;
        price: string;
        image_url: string;
        affiliate_url: string;
        source_url: string;
      }>("/api/admin/shopee", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: shopeeLink }),
      });
      setStore("shopee");
      setEditing(null);
      setForm({
        title: p.title,
        price: p.price,
        old_price: "",
        image_url: p.image_url,
        affiliate_url: p.affiliate_url,
      });
      setSourceUrl(p.source_url);
      setShopeeLink("");
      setShopeeMsg({
        ok: true,
        text: `Encontrado: ${p.title}${p.price ? ` · R$ ${p.price}` : ""}. Confira os campos e clique em "Adicionar à vitrine".`,
      });
    } catch (e) {
      setShopeeMsg({ ok: false, text: e instanceof Error ? e.message : "Erro" });
    } finally {
      setShopeeBusy(false);
    }
  }
  async function refreshPrices() {
    setRefreshMsg("Atualizando…");
    try {
      const r = await api<{
        checked: number;
        changed: number;
        failed: { id: number; title: string; error: string }[];
      }>("/api/admin/shopee/refresh", { method: "POST" });
      setRefreshMsg(
        `Conferidos: ${r.checked} · preços alterados: ${r.changed} · falhas: ${r.failed.length}${r.failed[0] ? ` (${r.failed[0].error})` : ""}`,
      );
      refresh();
    } catch (e) {
      setRefreshMsg(e instanceof Error ? e.message : "Erro");
    }
  }
  async function importFile(f: File) {
    setReport(null);
    setImportError(null);
    try {
      setReport(
        await api<ImportReport>("/api/showcase/csv", {
          method: "POST",
          headers: { "content-type": "text/csv" },
          body: await f.text(),
        }),
      );
      refresh();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Falha ao importar");
    }
  }
  async function copyBookmarklet() {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET_HREF);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Produtos da vitrine</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Os produtos cadastrados aparecem como cards na aba da loja em <strong>/explorar</strong>,
        com o <strong>seu</strong> link no botão de compra. O preço é o que você informar aqui (o
        site mostra a data e avisa que pode mudar na loja), então mantenha-o atualizado.
      </p>

      <details className="rounded-xl border p-4 text-sm" open>
        <summary className="cursor-pointer font-medium">Cadastro rápido com o favorito</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            Arraste este botão para a barra de favoritos do navegador:{" "}
            <a
              ref={(el) => {
                // definido direto no DOM: o React bloqueia endereços javascript: no atributo href
                el?.setAttribute("href", BOOKMARKLET_HREF);
              }}
              onClick={(e) => e.preventDefault()}
              className="inline-block rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary"
              title="Arraste para a barra de favoritos"
            >
              Copiar produto (Mimá)
            </a>
            . Se não conseguir arrastar,{" "}
            <button className="underline" onClick={() => void copyBookmarklet()}>
              copie o código
            </button>{" "}
            e crie um favorito novo colando-o no campo do endereço.
            {copied && <span className="ml-1 text-success">Código copiado.</span>}
          </li>
          <li>
            Abra a página de um produto na loja (Mercado Livre, Shopee ou Amazon) e clique no
            favorito. Ele lê o título, a imagem e o preço que a página já mostra e{" "}
            <strong>copia</strong>.
          </li>
          <li>Cole aqui embaixo, confira os campos e cole o seu link de afiliado.</li>
        </ol>
        <input
          aria-label="Colar dados do produto"
          placeholder="Cole aqui o que o favorito copiou"
          className="mt-3 w-full rounded-full border px-3 py-2 text-xs"
          value={paste}
          onChange={(e) => applyPaste(e.target.value)}
        />
        {pasteMsg && (
          <p
            role={pasteMsg.ok ? "status" : "alert"}
            className={cn("mt-2 text-xs", pasteMsg.ok ? "text-success" : "text-destructive")}
          >
            {pasteMsg.text}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          É feito pelo seu navegador, na página que você mesmo abriu; nada é buscado pelo servidor.
          Alguns sites bloqueiam favoritos ou mudam a página, então confira sempre o título e o
          preço.
        </p>
      </details>

      <details
        className="rounded-xl border p-4 text-sm"
        open={shopeeStatus.data?.configured === true}
      >
        <summary className="cursor-pointer font-medium">
          Importar da Shopee (API oficial de afiliados)
        </summary>
        {shopeeStatus.data?.configured === false && (
          <p className="mt-3 text-xs text-muted-foreground">
            Ainda não configurado. Precisa da aprovação no programa de afiliados da Shopee e das
            variáveis <code>SHOPEE_APP_ID</code> e <code>SHOPEE_APP_SECRET</code> (no Railway e no
            .env). Nunca cole o segredo em conversas.
          </p>
        )}
        <p className="mt-3 text-muted-foreground">
          Cole o link de um produto da Shopee (a página do produto ou um link curto). O sistema
          consulta a API da Shopee e preenche título, preço, imagem e o link de afiliado que a
          própria Shopee gera para a sua conta.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            aria-label="Link do produto da Shopee"
            placeholder="https://shopee.com.br/… ou https://shope.ee/…"
            className="min-w-0 flex-1 rounded-full border px-3 py-2 text-xs"
            value={shopeeLink}
            onChange={(e) => setShopeeLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && shopeeLink.trim() && void importShopee()}
          />
          <button
            className="filter-chip is-active"
            disabled={shopeeBusy || !shopeeLink.trim()}
            onClick={() => void importShopee()}
          >
            {shopeeBusy ? "Buscando…" : "Buscar produto"}
          </button>
        </div>
        {shopeeMsg && (
          <p
            role={shopeeMsg.ok ? "status" : "alert"}
            className={cn("mt-2 text-xs", shopeeMsg.ok ? "text-success" : "text-destructive")}
          >
            {shopeeMsg.text}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="filter-chip"
            disabled={shopeeStatus.data?.configured !== true}
            onClick={() => void refreshPrices()}
          >
            Atualizar preços da Shopee
          </button>
          {refreshMsg && <span className="text-xs text-muted-foreground">{refreshMsg}</span>}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Esta integração foi feita sem a documentação oficial da Shopee em mãos. Se a API recusar
          algo, a mensagem dela aparece aqui.
        </p>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <a className="filter-chip inline-flex items-center gap-2" href="/api/showcase/csv">
          <Download size={14} /> Baixar planilha
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
        <span className="text-xs text-muted-foreground">
          Colunas: id, loja, titulo, preco, preco_anterior, url_da_imagem, seu_link_de_afiliado.
          Linha sem id cria um produto; com id atualiza.
        </span>
      </div>
      {importError && (
        <p role="alert" className="text-sm text-destructive">
          {importError}
        </p>
      )}
      {report && (
        <div role="status" className="rounded-xl border p-3 text-sm">
          <p>
            Criados: <strong>{report.created}</strong> · atualizados:{" "}
            <strong>{report.updated}</strong> · com erro: {report.errors.length}
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
              setSourceUrl("");
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
              setSourceUrl("");
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
