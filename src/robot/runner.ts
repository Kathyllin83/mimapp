import { CRAWL_INTERVAL_MIN, CRAWL_INTERVAL_MIN_ALLOWED } from "./config";
import type { Connector } from "./connectors/shared";
import type { PoliteClient } from "./http";
import type { RobotStore, SourceHealth } from "./store";
import { StructureChangedError, type NormalizedOffer } from "./types";

const STALE_LOCK_MS = 60 * 60_000;
const BLOCKED_COOLDOWN_MS = 24 * 3_600_000;
const MAX_BACKOFF_MS = 6 * 3_600_000;

export type RunResult =
  | { source: string; outcome: "skipped"; reason: string }
  | {
      source: string;
      outcome: "ok" | "failing" | "blocked" | "structure_changed";
      reason: string | null;
      read: number;
      pages: number;
    };

export function intervalMinutes(env = process.env["ROBOT_INTERVAL_MIN"]): number {
  const n = Number(env);
  return Math.max(Number.isFinite(n) && n > 0 ? n : CRAWL_INTERVAL_MIN, CRAWL_INTERVAL_MIN_ALLOWED);
}

export async function runSource(
  connector: Connector,
  client: PoliteClient,
  store: RobotStore,
  opts: { now?: () => Date; intervalMin?: number; log?: (m: string) => void } = {},
): Promise<RunResult> {
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? (() => {});
  const source = connector.id;
  const health: SourceHealth = await store.getHealth(source);

  if (health.status === "disabled")
    return { source, outcome: "skipped", reason: "fonte desativada" };
  if (health.nextAttemptAt && health.nextAttemptAt > now()) {
    return {
      source,
      outcome: "skipped",
      reason: `aguardando até ${health.nextAttemptAt.toISOString()} (${health.status})`,
    };
  }
  if (!(await store.tryLock(source, now(), STALE_LOCK_MS))) {
    return { source, outcome: "skipped", reason: "coleta já em andamento" };
  }

  const collected: NormalizedOffer[] = [];
  let pages = 0;
  let outcome: "ok" | "failing" | "blocked" | "structure_changed" = "ok";
  let reason: string | null = null;
  try {
    const plan = await connector.pages(client);
    if ("stop" in plan) {
      ({ outcome, reason } = classify(plan.stop));
    } else {
      for (const url of plan.urls) {
        const res = await client.get(url);
        if (res.kind !== "ok") {
          const c = classify(res);
          outcome = c.outcome;
          reason = `${url}: ${c.reason}`;
          // bloqueio/robots: parar; falha comum: seguir para a próxima página
          if (outcome === "blocked") break;
          continue;
        }
        try {
          collected.push(...connector.parse(res.body, url));
          pages++;
          log(`${source} ${url} ok (${collected.length} ofertas)`);
        } catch (e) {
          if (e instanceof StructureChangedError) {
            outcome = "structure_changed";
            reason = `${url}: ${e.message}`;
            break;
          }
          throw e;
        }
      }
    }
    // Aproveita o que já foi lido com segurança, mesmo se a varredura parou no meio.
    if (collected.length) await store.upsertOffers(dedupeWithin(collected), now());
    if (outcome === "ok" && pages === 0) {
      outcome = "failing";
      reason ??= "nenhuma página lida";
    }
  } catch (e) {
    outcome = "failing";
    reason = e instanceof Error ? e.message : "erro inesperado";
  }

  const t = now();
  const failures = outcome === "ok" ? 0 : health.consecutiveFailures + 1;
  const base = (opts.intervalMin ?? CRAWL_INTERVAL_MIN) * 60_000;
  let next: Date | null = null;
  if (outcome === "blocked" || outcome === "structure_changed")
    next = new Date(t.getTime() + BLOCKED_COOLDOWN_MS);
  else if (outcome === "failing")
    next = new Date(t.getTime() + Math.min(base * 2 ** failures, MAX_BACKOFF_MS));
  await store.saveHealth({
    source,
    status: outcome === "ok" ? "operating" : outcome,
    reason,
    consecutiveFailures: failures,
    nextAttemptAt: next,
    runningSince: null,
    ...(outcome === "ok" ? { lastSuccessAt: t } : {}),
  });
  return { source, outcome, reason, read: collected.length, pages };
}

function classify(o: { kind: string; reason?: string }) {
  if (o.kind === "blocked" || o.kind === "robots-denied")
    return { outcome: "blocked" as const, reason: o.reason ?? o.kind };
  return { outcome: "failing" as const, reason: o.reason ?? o.kind };
}

function dedupeWithin(offers: NormalizedOffer[]): NormalizedOffer[] {
  const m = new Map<string, NormalizedOffer>();
  for (const o of offers) m.set(`${o.source}:${o.externalId}`, o);
  return [...m.values()];
}
