import { describe, expect, it } from "vitest";
import type { AFijarDetalleDto, StockCerealDto } from "../types";
import { cerealesDe, filtrarPorCereal, filtrarPorVencimiento } from "./filtros";

function fila(
  p: Partial<AFijarDetalleDto> & Pick<AFijarDetalleDto, "contrato" | "aFijarTn">,
): AFijarDetalleDto {
  return {
    comprador: "ADM",
    cereal: "Soja",
    campania: "20252026",
    vtoFijacion: null,
    diasParaVto: null,
    estado: "Verde",
    directo: true,
    corredor: null,
    ...p,
  };
}

function reporte(): StockCerealDto {
  return {
    fecha: "2026-08-24",
    campania: "2025-2026",
    campanias: ["2025-2026", "2024-2025"],
    plantasOtrasCampaniasTn: 0,
    consolidado: [
      { cereal: "Soja", p15: 1000, p20: 200, p10: 3000, silobolsa: 100, total: 4300 },
      { cereal: "Maíz", p15: 500, p20: 0, p10: 2000, silobolsa: 50, total: 2550 },
    ],
    detallePlanta10: [
      fila({ contrato: "S-1", cereal: "Soja", aFijarTn: 2000, estado: "Vencido", diasParaVto: -10 }),
      fila({ contrato: "S-2", cereal: "Soja", aFijarTn: 1000, estado: "Naranja", diasParaVto: 12 }),
      fila({ contrato: "M-1", cereal: "Maíz", aFijarTn: 2000, estado: "Verde", diasParaVto: 200 }),
    ],
    alertasDescarga: [
      { contrato: "S-9", comprador: "ADM", cereal: "Soja", campania: "20252026", fijadoTn: 30 },
      { contrato: "M-9", comprador: "ADM", cereal: "Maíz", campania: "20252026", fijadoTn: 40 },
    ],
    totales: {
      p15: 1500, p20: 200, p10: 5000, silobolsa: 150, total: 6850,
      vencidoTn: 2000, vencidoContratos: 1, proximo30Tn: 1000, proximo30Contratos: 1,
    },
    silobolsaPendiente: false,
  };
}

describe("filtrarPorCereal", () => {
  it("acota el reporte entero y recalcula los totales", () => {
    const r = filtrarPorCereal(reporte(), "Soja");

    expect(r.consolidado.map((c) => c.cereal)).toEqual(["Soja"]);
    expect(r.detallePlanta10.map((d) => d.contrato)).toEqual(["S-1", "S-2"]);
    expect(r.alertasDescarga.map((a) => a.contrato)).toEqual(["S-9"]);
    expect(r.totales).toMatchObject({
      p15: 1000, p20: 200, p10: 3000, silobolsa: 100, total: 4300,
      vencidoTn: 2000, vencidoContratos: 1, proximo30Tn: 1000, proximo30Contratos: 1,
    });
  });

  it("sin cereal elegido devuelve el reporte intacto", () => {
    const original = reporte();
    expect(filtrarPorCereal(original, "")).toBe(original);
  });

  it("lista los cereales del consolidado en el orden del backend", () => {
    expect(cerealesDe(reporte())).toEqual(["Soja", "Maíz"]);
  });
});

describe("filtrarPorVencimiento", () => {
  const filas = [
    fila({ contrato: "venc", aFijarTn: 10, estado: "Vencido", diasParaVto: -3 }),
    fila({ contrato: "nar", aFijarTn: 10, estado: "Naranja", diasParaVto: 12 }),
    fila({ contrato: "ama", aFijarTn: 10, estado: "Amarillo", diasParaVto: 45 }),
    fila({ contrato: "ver", aFijarTn: 10, estado: "Verde", diasParaVto: 200 }),
    fila({ contrato: "s/f", aFijarTn: 10, estado: "SinFecha" }),
  ];

  it("urgente junta lo vencido y lo que vence dentro de 30 días", () => {
    expect(filtrarPorVencimiento(filas, "urgente").map((f) => f.contrato)).toEqual(["venc", "nar"]);
  });

  it("filtra por un estado puntual del semáforo", () => {
    expect(filtrarPorVencimiento(filas, "Vencido").map((f) => f.contrato)).toEqual(["venc"]);
    expect(filtrarPorVencimiento(filas, "SinFecha").map((f) => f.contrato)).toEqual(["s/f"]);
  });

  it("sin filtro devuelve todo", () => {
    expect(filtrarPorVencimiento(filas, "")).toHaveLength(5);
  });
});
