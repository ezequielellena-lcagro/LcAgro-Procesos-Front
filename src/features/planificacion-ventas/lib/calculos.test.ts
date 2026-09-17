import { describe, expect, it } from "vitest";
import { costoUsdHa, mercadoUsd, potencialTn, totalHectareas } from "./calculos";

const marketShare = {
  soja: { costoUsdHa: 292.5, rindeTnHa: 4 },
  maiz: { costoUsdHa: 612, rindeTnHa: 8 },
  trigo: { costoUsdHa: 330, rindeTnHa: 3 },
};

describe("cálculos del plan de siembra", () => {
  it("repite los costos y el caso de mercado/potencial de T1.4", () => {
    expect(costoUsdHa(9, 325)).toBe(292.5);
    expect(costoUsdHa(34, 180)).toBe(612);
    expect(costoUsdHa(15, 220)).toBe(330);
    const plan = { soja: 100, maiz: 50, trigo: 20, otro: 10 };
    expect(totalHectareas(plan)).toBe(180);
    expect(mercadoUsd(plan, marketShare)).toBe(66450);
    expect(potencialTn(plan, marketShare)).toBe(860);
  });

  it("Otro cuenta hectáreas pero no suma mercado ni potencial", () => {
    const plan = { soja: null, maiz: null, trigo: null, otro: 10 };
    expect(totalHectareas(plan)).toBe(10);
    expect(mercadoUsd(plan, marketShare)).toBe(0);
    expect(potencialTn(plan, marketShare)).toBe(0);
  });

  it("sin plan o Market Share muestra ausencia, no cero", () => {
    expect(mercadoUsd(null, marketShare)).toBeNull();
    expect(mercadoUsd({ soja: 10, maiz: null, trigo: null, otro: null }, null)).toBeNull();
    expect(potencialTn(null, marketShare)).toBeNull();
  });

  it("conserva decimales chicos en los cálculos", () => {
    const params = {
      soja: { costoUsdHa: costoUsdHa(1, 1), rindeTnHa: 0.125 },
      maiz: marketShare.maiz,
      trigo: marketShare.trigo,
    };
    expect(mercadoUsd({ soja: 0.25, maiz: null, trigo: null, otro: null }, params)).toBe(0.025);
    expect(potencialTn({ soja: 0.25, maiz: null, trigo: null, otro: null }, params)).toBe(0.03125);
  });
});
