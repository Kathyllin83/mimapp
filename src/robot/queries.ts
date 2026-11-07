import { dbQuery } from "../lib/server/db";
import { HISTORY, MARKETPLACE_SLUGS } from "./config";
import { amazonAffiliateUrl } from "./normalize";
import { getAmazonTag } from "./settings";
import { TOPIC_RULES } from "./topics";

export interface OfferItem {
  id: number;
  title: string;
  image_url: string | null;
  marketplace: string;
  category: string | null;
  topics: string[];
  price: number;
  currency: "BRL";
  old_price: number | null;
  discount_pct: number | null;
  discount_validated: boolean;
  score: number;
  flags: string[];
  buy_url: string | null;
  buy_url_is_affiliate: boolean;
  updated_at: string;
}
export interface OffersPage {
  data: OfferItem[];
  current_page: number;
  last_page: number;
  total: number;
  /** Última coleta bem-sucedida de qualquer fonte; `stalled` indica coleta parada/bloqueada. */
  freshness: { last_success_at: string | null; stalled: boolean };
}

export interface OffersQuery {
  topic: string[];
  marketplace: string[];
  category: string | null;
  q: string | null;
  minScore: number;
  sort: "score" | "price" | "recent";
  validatedOnly: boolean;
  withAffiliateLink: boolean;
  perPage: number;
  page: number;
}

const csv = (v: string | null) =>
  v
    ? v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
const int = (v: string | null, d: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : d;
};

export function parseOffersQuery(sp: URLSearchParams): OffersQuery {
  const sort = sp.get("sort");
  return {
    topic: csv(sp.get("topic")).filter((t) => TOPIC_RULES.some((r) => r.slug === t)),
    marketplace: csv(sp.get("marketplace")).filter((m) =>
      (MARKETPLACE_SLUGS as string[]).includes(m),
    ),
    category: sp.get("category")?.trim() || null,
    q: sp.get("q")?.trim().slice(0, 100) || null,
    minScore: Math.max(0, Math.min(100, int(sp.get("min_score"), 0))),
    sort: sort === "price" || sort === "recent" ? sort : "score",
    validatedOnly: sp.get("validated_only") === "1",
    withAffiliateLink: sp.get("with_affiliate_link") === "1",
    perPage: Math.max(1, Math.min(100, int(sp.get("per_page"), 24))),
    page: Math.max(1, int(sp.get("page"), 1)),
  };
}

const ORDER = {
  score: "score DESC, updated_at DESC",
  price: "price ASC, score DESC",
  recent: "first_seen_at DESC, score DESC",
} as const;

interface Row {
  id: string;
  title: string;
  image_url: string | null;
  marketplace: string;
  category: string | null;
  topics: string[];
  price: string;
  old_price: string | null;
  discount_pct: string | null;
  discount_validated: boolean;
  score: number;
  flags: string[];
  clean_url: string | null;
  any_clean_url?: string | null;
  affiliate_url: string | null;
  updated_at: Date;
  total: string;
}

export async function listOffers(q: OffersQuery): Promise<OffersPage> {
  const where: string[] = ["score >= $1"];
  const args: unknown[] = [q.minScore];
  const add = (sql: string, v: unknown) => {
    args.push(v);
    where.push(sql.replace("?", `$${args.length}`));
  };
  if (q.topic.length) add("topics && ?::text[]", q.topic);
  if (q.marketplace.length) add("marketplace = ANY(?::text[])", q.marketplace);
  if (q.category) add("category = ?", q.category);
  if (q.q) add("title ILIKE ?", `%${q.q.replace(/[\\%_]/g, "\\$&")}%`);
  if (q.validatedOnly) {
    where.push("discount_validated = true AND NOT ('possible_fake_promotion' = ANY(flags))");
  }
  if (q.withAffiliateLink) where.push("affiliate_url IS NOT NULL");
  args.push(q.perPage, (q.page - 1) * q.perPage);

  const { rows } = await dbQuery<Row>(
    `WITH visible AS (
       SELECT o.*, a.url AS affiliate_url,
              max(o.clean_url) OVER (PARTITION BY o.dedupe_key) AS any_clean_url
       FROM robot_offers o LEFT JOIN robot_affiliate_links a USING (dedupe_key)
       WHERE o.source_status = 'active'
         AND o.last_seen_at > now() - make_interval(hours => ${HISTORY.expireAfterHours})
     ), best AS (
       SELECT DISTINCT ON (dedupe_key) * FROM visible ORDER BY dedupe_key, score DESC, updated_at DESC
     )
     SELECT *, count(*) OVER () AS total FROM best
     WHERE ${where.join(" AND ")}
     ORDER BY ${ORDER[q.sort]}
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );
  const total = rows[0] ? Number(rows[0].total) : 0;
  const amazonTag = await getAmazonTag();
  return {
    data: rows.map((r) => toItem(r, amazonTag)),
    current_page: q.page,
    last_page: Math.max(1, Math.ceil(total / q.perPage)),
    total,
    freshness: await freshness(),
  };
}

function toItem(r: Row, amazonTag: string | null): OfferItem {
  const storeUrl = r.clean_url ?? r.any_clean_url ?? null;
  // Amazon: sem link cadastrado, usa a URL limpa + o código de associado do dono do site
  const auto =
    !r.affiliate_url && r.marketplace === "amazon" ? amazonAffiliateUrl(storeUrl, amazonTag) : null;
  return {
    id: Number(r.id),
    title: r.title,
    image_url: r.image_url,
    marketplace: r.marketplace,
    category: r.category,
    topics: r.topics,
    price: Number(r.price),
    currency: "BRL",
    old_price: r.old_price === null ? null : Number(r.old_price),
    discount_pct: r.discount_pct === null ? null : Number(r.discount_pct),
    discount_validated: r.discount_validated,
    score: r.score,
    flags: r.flags,
    // SOMENTE o link de afiliado cadastrado pelo dono; senão a URL limpa; senão null.
    buy_url: r.affiliate_url ?? auto ?? storeUrl,
    buy_url_is_affiliate: r.affiliate_url !== null || auto !== null,
    updated_at: r.updated_at.toISOString(),
  };
}

async function freshness(): Promise<OffersPage["freshness"]> {
  const { rows } = await dbQuery<{ last: Date | null; operating: string }>(
    `SELECT max(last_success_at) AS last,
            count(*) FILTER (WHERE status = 'operating' AND last_success_at > now() - interval '3 hours') AS operating
     FROM robot_source_health`,
  );
  const r = rows[0];
  return {
    last_success_at: r?.last ? r.last.toISOString() : null,
    stalled: !r || Number(r.operating) === 0,
  };
}
