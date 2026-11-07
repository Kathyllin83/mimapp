import type { Plan, PlanId } from "./types";

/** Valores provisórios — configuráveis no painel administrativo. */
export const DEFAULT_PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Gratuito",
    priceMonthly: 0,
    maxTracked: 5,
    aiQueriesMonthly: 3,
    features: [
      "Explorar promoções",
      "Favoritar produtos",
      "Acompanhar até 5 produtos",
      "3 consultas inteligentes mensais",
    ],
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceMonthly: 9.9,
    maxTracked: 30,
    aiQueriesMonthly: 30,
    features: [
      "Até 30 produtos monitorados",
      "30 consultas inteligentes mensais",
      "Alertas personalizados",
      "Histórico de preços",
      "Caçadora de Dupes",
    ],
  },
  plus: {
    id: "plus",
    name: "Premium Plus",
    priceMonthly: 19.9,
    maxTracked: 100,
    aiQueriesMonthly: 100,
    features: [
      "Até 100 produtos monitorados",
      "100 consultas inteligentes mensais",
      "Recursos avançados de comparação",
      "Prioridade nos alertas",
    ],
  },
};

/** Regra de cota (espelhada no backend futuramente — o backend é a fonte da verdade). */
export function canUseAi(plan: Plan, usedThisMonth: number) {
  return usedThisMonth < plan.aiQueriesMonthly;
}

export function remainingAi(plan: Plan, usedThisMonth: number) {
  return Math.max(0, plan.aiQueriesMonthly - usedThisMonth);
}

export function canTrackMore(plan: Plan, tracked: number) {
  return tracked < plan.maxTracked;
}
