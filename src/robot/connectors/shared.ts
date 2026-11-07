import type { SourceId } from "../config";
import type { PoliteClient, FetchOutcome } from "../http";
import { StructureChangedError, type NormalizedOffer } from "../types";

export interface Connector {
  id: SourceId;
  /** Páginas a coletar nesta varredura (pode consultar a fonte, sempre via PoliteClient). */
  pages(client: PoliteClient): Promise<{ urls: string[] } | { stop: FetchOutcome }>;
  /** Lê uma página. Lança StructureChangedError se os campos essenciais sumirem. */
  parse(html: string, pageUrl: string): NormalizedOffer[];
}

export function extractNextData(html: string): Record<string, unknown> {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) throw new StructureChangedError("__NEXT_DATA__ não encontrado");
  try {
    return JSON.parse(m[1]!) as Record<string, unknown>;
  } catch {
    throw new StructureChangedError("__NEXT_DATA__ inválido");
  }
}

export function pageProps(html: string): Record<string, unknown> {
  const data = extractNextData(html);
  const props = (data["props"] as { pageProps?: Record<string, unknown> } | undefined)?.pageProps;
  if (!props || typeof props !== "object") throw new StructureChangedError("pageProps ausente");
  return props;
}

export const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
export const asString = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
export const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
