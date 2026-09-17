import type { HectareasPlan, MarketShareGrilla } from "../types";

export function costoUsdHa(qqInsumoHa: number, precioUsdTn: number): number {
  return (qqInsumoHa * precioUsdTn) / 10;
}

export function totalHectareas(plan: HectareasPlan | null): number {
  if (!plan) return 0;
  return (plan.soja ?? 0) + (plan.maiz ?? 0) + (plan.trigo ?? 0) + (plan.otro ?? 0);
}

export function mercadoUsd(
  plan: HectareasPlan | null,
  marketShare: MarketShareGrilla | null,
): number | null {
  if (!plan || !marketShare) return null;
  return (
    (plan.soja ?? 0) * marketShare.soja.costoUsdHa +
    (plan.maiz ?? 0) * marketShare.maiz.costoUsdHa +
    (plan.trigo ?? 0) * marketShare.trigo.costoUsdHa
  );
}

export function potencialTn(
  plan: HectareasPlan | null,
  marketShare: MarketShareGrilla | null,
): number | null {
  if (!plan || !marketShare) return null;
  return (
    (plan.soja ?? 0) * marketShare.soja.rindeTnHa +
    (plan.maiz ?? 0) * marketShare.maiz.rindeTnHa +
    (plan.trigo ?? 0) * marketShare.trigo.rindeTnHa
  );
}
