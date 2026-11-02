import { describe, expect, it } from "vitest";
import type { EvolucionMes } from "../types";
import { acumular, cerealesDe, mesSiguiente } from "./evolucion";

function fila(p: Partial<EvolucionMes>): EvolucionMes {
  return {
    campania: "2025-2026",
    cereal: "Soja",
    mes: "2025-03",
    tnC: 0,
    tnCP: 0,
    usdC: 0,
    tnV: 0,
    tnVP: 0,
    usdV: 0,
    apertura: false,
    ...p,
  };
}

describe("evolucion", () => {
  it("el último mes da igual que la tarjeta, con la apertura de arrastre y ajustes", () => {
    // Mismo caso que el test del back: compras 100 tn a 300; ventas 90 tn (50 a 305, 40 a 310);
    // arrastre vendido de 20 tn a 312 y 5 tn de semilla sin precio en la apertura.
    const filas = [
      fila({ mes: "2025-03", tnC: 60, tnCP: 60, usdC: 18_000, tnV: 50, tnVP: 50, usdV: 15_250 }),
      fila({ mes: "2025-03", apertura: true, tnV: 25, tnVP: 20, usdV: 6_240 }),
      fila({ mes: "2025-06", tnC: 40, tnCP: 40, usdC: 12_000, tnV: 40, tnVP: 40, usdV: 12_400 }),
    ];
    const pv = (15_250 + 12_400 + 6_240) / 110;
    const tarjeta = (((pv - 300) * 100) / (100 * 300)) * 100;

    const puntos = acumular(filas);

    expect(puntos.map((p) => p.mes)).toEqual(["2025-03", "2025-04", "2025-05", "2025-06"]);
    expect(puntos.at(-1)!.porCampania["2025-2026"].pct).toBeCloseTo(tarjeta, 6);
    expect(puntos.at(-1)!.pctTotal).toBeCloseTo(tarjeta, 6);
  });

  it("el total suma resultados de cada campaña y el mes muestra lo que se movió", () => {
    const filas = [
      fila({
        campania: "2024-2025",
        mes: "2025-01",
        tnC: 10,
        tnCP: 10,
        usdC: 3_000,
        tnV: 10,
        tnVP: 10,
        usdV: 3_100,
      }),
      fila({
        campania: "2025-2026",
        mes: "2025-02",
        tnC: 10,
        tnCP: 10,
        usdC: 2_000,
        tnV: 10,
        tnVP: 10,
        usdV: 1_950,
      }),
    ];

    const [enero, febrero] = acumular(filas);

    expect(enero.resultadoTotal).toBeCloseTo(100);
    expect(febrero.resultadoTotal).toBeCloseTo(50); // +100 de una y −50 de la otra
    expect(febrero.resultadoMes).toBeCloseTo(-50);
    expect(febrero.pctTotal).toBeCloseTo((50 / 5_000) * 100);
  });

  it("filtra por cereal sin volver al servidor", () => {
    const filas = [
      fila({ cereal: "Soja", tnC: 10, tnCP: 10, usdC: 3_000, tnV: 10, tnVP: 10, usdV: 3_300 }),
      fila({ cereal: "Maíz", tnC: 10, tnCP: 10, usdC: 1_800, tnV: 10, tnVP: 10, usdV: 1_700 }),
    ];

    expect(cerealesDe(filas)).toEqual(["Maíz", "Soja"]);
    expect(acumular(filas, new Set(["Soja"]))[0].porCampania["2025-2026"].pct).toBeCloseTo(10);
  });

  it("pasa de diciembre a enero", () => {
    expect(mesSiguiente("2025-12")).toBe("2026-01");
    expect(mesSiguiente("2026-09")).toBe("2026-10");
  });
});
