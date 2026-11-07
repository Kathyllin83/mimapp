import { dbQuery, dbTransaction } from "../lib/server/db";
import type { SourceId } from "./config";
import { dedupeKey } from "./normalize";
import { analyze, shouldRecordPoint, type PricePoint } from "./pricing";
import { classifyTopics } from "./topics";
import type { NormalizedOffer } from "./types";

export type HealthStatus = "operating" | "failing" | "blocked" | "structure_changed" | "disabled";
export interface SourceHealth {
  source: SourceId;
  status: HealthStatus;
  reason: string | null;
  consecutiveFailures: number;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  nextAttemptAt: Date | null;
  runningSince: Date | null;
}

/** Contrato de persistência do robô (Postgres em produção, memória nos testes). */
export interface RobotStore {
  getHealth(source: SourceId): Promise<SourceHealth>;
  /** Lock atômico: nunca duas coletas da mesma fonte ao mesmo tempo. Lock velho (> staleMs) é retomado. */
  tryLock(source: SourceId, now: Date, staleMs: number): Promise<boolean>;
  saveHealth(h: Partial<SourceHealth> & { source: SourceId }): Promise<void>;
  upsertOffers(
    offers: NormalizedOffer[],
    now: Date,
  ): Promise<{ upserted: number; pricePoints: number }>;
}

const emptyHealth = (source: SourceId): SourceHealth => ({
  source,
  status: "operating",
  reason: null,
  consecutiveFailures: 0,
  lastAttemptAt: null,
  lastSuccessAt: null,
  nextAttemptAt: null,
  runningSince: null,
});

interface HealthRow {
  source: SourceId;
  status: HealthStatus;
  reason: string | null;
  consecutive_failures: number;
  last_attempt_at: Date | null;
  last_success_at: Date | null;
  next_attempt_at: Date | null;
  running_since: Date | null;
}

export const pgStore: RobotStore = {
  async getHealth(source) {
    const { rows } = await dbQuery<HealthRow>(
      "SELECT * FROM robot_source_health WHERE source = $1",
      [source],
    );
    const r = rows[0];
    if (!r) return emptyHealth(source);
    return {
      source,
      status: r.status,
      reason: r.reason,
      consecutiveFailures: r.consecutive_failures,
      lastAttemptAt: r.last_attempt_at,
      lastSuccessAt: r.last_success_at,
      nextAttemptAt: r.next_attempt_at,
      runningSince: r.running_since,
    };
  },

  async tryLock(source, now, staleMs) {
    await dbQuery("INSERT INTO robot_source_health (source) VALUES ($1) ON CONFLICT DO NOTHING", [
      source,
    ]);
    const { rowCount } = await dbQuery(
      `UPDATE robot_source_health SET running_since = $2, last_attempt_at = $2
       WHERE source = $1 AND (running_since IS NULL OR running_since < $3)`,
      [source, now, new Date(now.getTime() - staleMs)],
    );
    return (rowCount ?? 0) > 0;
  },

  async saveHealth(h) {
    await dbQuery("INSERT INTO robot_source_health (source) VALUES ($1) ON CONFLICT DO NOTHING", [
      h.source,
    ]);
    const cols: Record<string, unknown> = {
      status: h.status,
      reason: h.reason,
      consecutive_failures: h.consecutiveFailures,
      last_attempt_at: h.lastAttemptAt,
      last_success_at: h.lastSuccessAt,
      next_attempt_at: h.nextAttemptAt,
      running_since: h.runningSince,
    };
    const keys = Object.keys(cols).filter((k) => {
      const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()) as keyof SourceHealth;
      return camel in h;
    });
    if (!keys.length) return;
    await dbQuery(
      `UPDATE robot_source_health SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE source = $1`,
      [h.source, ...keys.map((k) => cols[k])],
    );
  },

  async upsertOffers(offers, now) {
    let pricePoints = 0;
    await dbTransaction(async (c) => {
      for (const o of offers) {
        const topics = classifyTopics({
          title: o.title,
          subcategory: o.subcategory,
          category: o.category,
        });
        const up = await c.query<{ id: string }>(
          `INSERT INTO robot_offers (source, external_id, dedupe_key, title, image_url, marketplace, category,
             subcategory, topics, price, old_price, source_status, popularity, source_url, clean_url,
             first_seen_at, last_seen_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16,$16)
           ON CONFLICT (source, external_id) DO UPDATE SET
             dedupe_key = EXCLUDED.dedupe_key, title = EXCLUDED.title, image_url = EXCLUDED.image_url,
             marketplace = EXCLUDED.marketplace, category = EXCLUDED.category, subcategory = EXCLUDED.subcategory,
             topics = EXCLUDED.topics, price = EXCLUDED.price, old_price = EXCLUDED.old_price,
             source_status = EXCLUDED.source_status, popularity = EXCLUDED.popularity,
             source_url = EXCLUDED.source_url, clean_url = COALESCE(EXCLUDED.clean_url, robot_offers.clean_url),
             last_seen_at = EXCLUDED.last_seen_at, updated_at = EXCLUDED.updated_at
           RETURNING id`,
          [
            o.source,
            o.externalId,
            dedupeKey(o.title, o.marketplace),
            o.title,
            o.imageUrl,
            o.marketplace,
            o.category,
            o.subcategory,
            topics,
            o.price,
            o.oldPrice,
            o.status,
            o.popularity,
            o.sourceUrl,
            o.cleanUrl,
            now,
          ],
        );
        const id = up.rows[0]!.id;
        const last = await c.query<{ price: string; recorded_at: Date }>(
          "SELECT price, recorded_at FROM robot_price_points WHERE offer_id = $1 ORDER BY recorded_at DESC LIMIT 1",
          [id],
        );
        const lastPoint: PricePoint | undefined = last.rows[0]
          ? { price: Number(last.rows[0].price), recordedAt: last.rows[0].recorded_at }
          : undefined;
        if (shouldRecordPoint(lastPoint, o.price, now)) {
          await c.query(
            "INSERT INTO robot_price_points (offer_id, price, recorded_at) VALUES ($1,$2,$3)",
            [id, o.price, now],
          );
          pricePoints++;
        }
        const hist = await c.query<{ price: string; recorded_at: Date }>(
          "SELECT price, recorded_at FROM robot_price_points WHERE offer_id = $1 ORDER BY recorded_at",
          [id],
        );
        const result = analyze({
          price: o.price,
          oldPrice: o.oldPrice,
          status: o.status,
          popularity: o.popularity,
          history: hist.rows.map((r) => ({ price: Number(r.price), recordedAt: r.recorded_at })),
        });
        await c.query(
          "UPDATE robot_offers SET discount_pct = $2, discount_validated = $3, score = $4, flags = $5 WHERE id = $1",
          [id, result.discountPct, result.discountValidated, result.score, result.flags],
        );
      }
    });
    return { upserted: offers.length, pricePoints };
  },
};
