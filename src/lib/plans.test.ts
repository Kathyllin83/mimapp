import { describe, expect, it } from "vitest";
import { DEFAULT_PLANS, canTrackMore, canUseAi } from "./plans";

describe("planos", () => {
  it("preços provisórios", () => {
    expect(DEFAULT_PLANS.free.priceMonthly).toBe(0);
    expect(DEFAULT_PLANS.premium.priceMonthly).toBe(9.9);
    expect(DEFAULT_PLANS.plus.priceMonthly).toBe(19.9);
  });
  it("gratuito bloqueia a 4ª consulta", () => {
    expect(canUseAi(DEFAULT_PLANS.free, 2)).toBe(true);
    expect(canUseAi(DEFAULT_PLANS.free, 3)).toBe(false);
  });
  it("premium permite 30 consultas", () => {
    expect(canUseAi(DEFAULT_PLANS.premium, 29)).toBe(true);
    expect(canUseAi(DEFAULT_PLANS.premium, 30)).toBe(false);
  });
  it("limites de produtos monitorados", () => {
    expect(canTrackMore(DEFAULT_PLANS.free, 5)).toBe(false);
    expect(canTrackMore(DEFAULT_PLANS.premium, 29)).toBe(true);
    expect(canTrackMore(DEFAULT_PLANS.plus, 100)).toBe(false);
  });
});
