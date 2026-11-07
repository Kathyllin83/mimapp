import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";

/** Código de associado da Amazon: gera o botão de compra das ofertas da Amazon automaticamente. */
export function AmazonTagPanel() {
  const qc = useQueryClient();
  const current = useQuery({
    queryKey: ["amazon-tag"],
    queryFn: () => api<{ tag: string | null }>("/api/admin/amazon-tag"),
    retry: false,
  });
  const [value, setValue] = useState<string | null>(null);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; msg?: string }>(
    {
      kind: "idle",
    },
  );
  const tag = value ?? current.data?.tag ?? "";

  async function run(method: "PUT" | "DELETE") {
    setState({ kind: "saving" });
    try {
      await api("/api/admin/amazon-tag", {
        method,
        headers: { "content-type": "application/json" },
        body: method === "PUT" ? JSON.stringify({ tag }) : null,
      });
      setValue(method === "DELETE" ? "" : null);
      setState(method === "PUT" ? { kind: "saved" } : { kind: "idle" });
      await qc.invalidateQueries({ queryKey: ["amazon-tag"] });
      await qc.invalidateQueries({ queryKey: ["offers"] });
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message : "Erro" });
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Código de associado da Amazon</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Com o seu código, todas as ofertas da Amazon que têm a página do produto ganham o botão de
        compra automaticamente, no formato <code>amazon.com.br/dp/…?tag=seu-codigo</code>. Um link
        que você cadastrar para um produto continua valendo no lugar do automático. Apague o código
        para desligar.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Código de associado da Amazon"
          placeholder="seusite-20"
          className="min-w-0 rounded-full border px-3 py-2 text-xs"
          value={tag}
          onChange={(e) => {
            setValue(e.target.value);
            setState({ kind: "idle" });
          }}
        />
        <button
          className="filter-chip is-active"
          disabled={!tag.trim() || state.kind === "saving"}
          onClick={() => void run("PUT")}
        >
          Salvar
        </button>
        {current.data?.tag && (
          <button
            className="filter-chip"
            disabled={state.kind === "saving"}
            onClick={() => void run("DELETE")}
          >
            Desligar
          </button>
        )}
        {state.kind === "saved" && <span className="text-xs text-success">Salvo.</span>}
        {state.kind === "error" && (
          <span role="alert" className="text-xs text-destructive">
            {state.msg}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {current.data?.tag ? `Ativo: ${current.data.tag}` : "Desligado: sem link automático."}
      </p>
    </section>
  );
}
