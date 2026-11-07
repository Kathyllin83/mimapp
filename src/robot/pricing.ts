import { DEFAULT_WEIGHTS, HISTORY, type ScoreWeights } from "./config";

export interface PricePoint {
  price: number;
  recordedAt: Date;
}
export interface PricingInput {
  price: number;
  oldPrice: number | null;
  status: "active" | "closed";
  popularity: number;
  history: PricePoint[];
}
export interface PricingResult {
  discountPct: number | null;
  discountValidated: boolean;
  score: number;
  flags: string[];
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

const DAY = 86_400_000;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function historyStats(history: PricePoint[]) {
  const days = new Set(history.map((p) => p.recordedAt.toISOString().slice(0, 10)));
  const times = history.map((p) => p.recordedAt.getTime());
  const spanDays = times.length ? (Math.max(...times) - Math.min(...times)) / DAY : 0;
  return { distinctDays: days.size, spanDays };
}

export function analyze(
  input: PricingInput,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): PricingResult {
  const { price, oldPrice, status, popularity, history } = input;
  const flags: string[] = [];
  const { distinctDays, spanDays } = historyStats(history);
  const validated = distinctDays >= HISTORY.minDistinctDays && spanDays >= HISTORY.minSpanDays;
  const claimed = oldPrice && oldPrice > price ? 1 - price / oldPrice : 0;

  let discountPct: number | null = claimed > 0 ? round2(claimed * 100) : null;
  let discountValidated = false;
  let discountComponent: number;
  let nearLow = 0;

  if (validated) {
    const med = median(history.map((p) => p.price));
    const low = Math.min(...history.map((p) => p.price));
    const real = clamp01(1 - price / med);
    nearLow = clamp01(low / price);
    discountValidated = true;
    // mediana ~ preço atual (até +5%) mas a fonte alega desconto => falsa promoção
    if (claimed > 0 && med <= price * (1 + HISTORY.fakePromoTolerance)) {
      flags.push("possible_fake_promotion");
      discountPct = round2(real * 100);
      discountComponent = 0;
    } else {
      discountPct = real > 0 ? round2(real * 100) : null;
      discountComponent = clamp01(real / 0.5);
    }
  } else {
    flags.push("discount_unvalidated");
    discountComponent = clamp01(claimed / 0.5) * 0.4;
  }

  const reliability = clamp01(distinctDays / HISTORY.minSpanDays) * (validated ? 1 : 0.5);
  const available = status === "active" ? 1 : 0;
  const w = weights;
  let score =
    discountComponent * w.discount +
    nearLow * w.nearLow +
    clamp01(popularity / 100) * w.popularity +
    reliability * w.reliability +
    available * w.availability;
  const total = w.discount + w.nearLow + w.popularity + w.reliability + w.availability;
  score = total > 0 ? (score / total) * 100 : 0;
  if (!available) {
    score = Math.min(score, 20);
    flags.push("unavailable");
  }
  return {
    discountPct,
    discountValidated,
    score: Math.round(Math.max(0, Math.min(100, score))),
    flags,
  };
}

/** Grava ponto só se o preço mudou ou passaram `repeatPointHours` desde o último. */
export function shouldRecordPoint(last: PricePoint | undefined, price: number, now: Date): boolean {
  if (!last) return true;
  if (Math.abs(last.price - price) > 0.001) return true;
  return now.getTime() - last.recordedAt.getTime() >= HISTORY.repeatPointHours * 3_600_000;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
