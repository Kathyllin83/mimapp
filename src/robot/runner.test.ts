// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PoliteClient } from "./http";
import { runSource } from "./runner";
import type { Connector } from "./connectors/shared";
import { promobit } from "./connectors/promobit";
import type { RobotStore, SourceHealth } from "./store";
import type { NormalizedOffer } from "./types";

function memStore(): RobotStore & {
  saved: SourceHealth;
  upserts: NormalizedOffer[][];
  locked: boolean;
} {
  const s = {
    saved: {
      source: "promobit",
      status: "operating",
      reason: null,
      consecutiveFailures: 0,
      lastAttemptAt: null,
      lastSuccessAt: null,
      nextAttemptAt: null,
      runningSince: null,
    } as SourceHealth,
    upserts: [] as NormalizedOffer[][],
    locked: false,
    async getHealth() {
      return s.saved;
    },
    async tryLock() {
      if (s.locked) return false;
      s.locked = true;
      return true;
    },
    async saveHealth(h: Partial<SourceHealth>) {
      s.locked = false;
      Object.assign(s.saved, h);
    },
    async upsertOffers(o: NormalizedOffer[]) {
      s.upserts.push(o);
      return { upserted: o.length, pricePoints: o.length };
    },
  };
  return s as never;
}

const html = (props: unknown) =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: props } })}</script>`;
const okOffer = {
  offerId: 1,
  offerTitle: "Batom",
  offerSlug: "b-1",
  offerPrice: 10,
  offerPriceType: "NORMAL",
  storeDomain: "amazon.com.br",
  storeParam: "amazon",
  storeName: "Amazon",
};

function clientFor(handler: (path: string) => Response) {
  let clock = 0;
  return new PoliteClient({
    userAgent: "MimaBot/1.0 (+t)",
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    fetchImpl: (async (u: URL) =>
      u.pathname === "/robots.txt"
        ? new Response("", { status: 404 })
        : handler(u.pathname)) as unknown as typeof fetch,
  });
}
const one: Connector = {
  id: "promobit",
  pages: async () => ({ urls: ["https://x.test/a", "https://x.test/b"] }),
  parse: promobit.parse,
};

describe("runSource", () => {
  it("coleta, grava e marca a fonte como operando", async () => {
    const store = memStore();
    const r = await runSource(
      one,
      clientFor(() => new Response(html({ serverOffers: { offers: [okOffer] } }))),
      store,
    );
    expect(r).toMatchObject({ outcome: "ok", pages: 2 });
    expect(store.saved.status).toBe("operating");
    expect(store.saved.lastSuccessAt).not.toBeNull();
  });
  it("HTTP 403: marca bloqueada, para e não tenta de novo agressivamente", async () => {
    const store = memStore();
    let hits = 0;
    const client = clientFor(() => {
      hits++;
      return new Response("no", { status: 403 });
    });
    const r = await runSource(one, client, store);
    expect(r.outcome).toBe("blocked");
    expect(hits).toBe(1); // parou na primeira página
    expect(store.saved.status).toBe("blocked");
    expect(store.saved.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    const again = await runSource(one, client, store);
    expect(again.outcome).toBe("skipped");
    expect(hits).toBe(1);
  });
  it("robots proibindo: não coleta e marca bloqueada", async () => {
    const store = memStore();
    let pageHits = 0;
    const client = new PoliteClient({
      userAgent: "MimaBot/1.0 (+t)",
      now: () => 0,
      sleep: async () => {},
      fetchImpl: (async (u: URL) => {
        if (u.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /");
        pageHits++;
        return new Response("x");
      }) as unknown as typeof fetch,
    });
    const r = await runSource(one, client, store);
    expect(r.outcome).toBe("blocked");
    expect(pageHits).toBe(0);
  });
  it("estrutura mudou: marca e para", async () => {
    const store = memStore();
    const r = await runSource(
      one,
      clientFor(() => new Response(html({ algo: 1 }))),
      store,
    );
    expect(r.outcome).toBe("structure_changed");
    expect(store.saved.status).toBe("structure_changed");
  });
  it("falhas consecutivas aumentam o backoff", async () => {
    const store = memStore();
    const client = clientFor(() => new Response("", { status: 500 }));
    await runSource(one, client, store, { intervalMin: 30 });
    const first = store.saved.nextAttemptAt!.getTime() - Date.now();
    store.saved.nextAttemptAt = null;
    await runSource(one, client, store, { intervalMin: 30 });
    expect(store.saved.consecutiveFailures).toBe(2);
    expect(store.saved.nextAttemptAt!.getTime() - Date.now()).toBeGreaterThan(first);
  });
  it("lock impede duas coletas simultâneas da mesma fonte", async () => {
    const store = memStore();
    store.locked = true;
    expect(
      (
        await runSource(
          one,
          clientFor(() => new Response("")),
          store,
        )
      ).outcome,
    ).toBe("skipped");
  });
});

// Integração com o Postgres real (pulada se o banco não estiver acessível).
let dbUp = false;
try {
  const { dbQuery } = await import("../lib/server/db");
  await dbQuery("SELECT 1 FROM robot_offers LIMIT 1");
  dbUp = true;
} catch {
  dbUp = false;
}
describe.skipIf(!dbUp)("pgStore (Postgres)", () => {
  const offer: NormalizedOffer = {
    source: "promobit",
    externalId: "__test__1",
    title: "Teste Batom Matte",
    imageUrl: null,
    marketplace: "amazon",
    category: null,
    subcategory: null,
    price: 50,
    oldPrice: 100,
    status: "active",
    popularity: 10,
    sourceUrl: "https://www.promobit.com.br/oferta/t",
    cleanUrl: null,
  };
  const clean = async () => {
    const { dbQuery } = await import("../lib/server/db");
    await dbQuery("DELETE FROM robot_offers WHERE external_id LIKE '\\_\\_test\\_\\_%'");
  };
  beforeAll(clean);
  afterAll(clean);
  it("rodar duas vezes não duplica nem repete ponto de preço; mudança de preço cria ponto", async () => {
    const { pgStore } = await import("./store");
    const { dbQuery } = await import("../lib/server/db");
    const t = new Date("2026-11-01T10:00:00Z");
    await pgStore.upsertOffers([offer], t);
    await pgStore.upsertOffers([offer], new Date(t.getTime() + 60_000));
    const rows = await dbQuery(
      "SELECT id, discount_validated, flags FROM robot_offers WHERE external_id = '__test__1'",
    );
    expect(rows.rows).toHaveLength(1);
    const id = rows.rows[0]!["id"];
    expect(
      (await dbQuery("SELECT 1 FROM robot_price_points WHERE offer_id = $1", [id])).rowCount,
    ).toBe(1);
    expect(rows.rows[0]!["discount_validated"]).toBe(false);
    await pgStore.upsertOffers([{ ...offer, price: 45 }], new Date(t.getTime() + 120_000));
    expect(
      (await dbQuery("SELECT 1 FROM robot_price_points WHERE offer_id = $1", [id])).rowCount,
    ).toBe(2);
  });
});
