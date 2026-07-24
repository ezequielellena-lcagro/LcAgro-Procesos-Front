import { describe, expect, it } from "vitest";
import type { StockQueryFiltros } from "./params";
import { stockParams } from "./params";

const BASE: StockQueryFiltros = { deposito: [], rubro: [] };

describe("stockParams — consolidado", () => {
  it("manda consolidado solo cuando está prendido", () => {
    expect(stockParams({ ...BASE, consolidado: true }).consolidado).toBe(true);
  });

  it("lo omite cuando está apagado o ausente (default del backend)", () => {
    expect(stockParams({ ...BASE, consolidado: false }).consolidado).toBeUndefined();
    expect(stockParams(BASE).consolidado).toBeUndefined();
  });
});

describe("stockParams — vacíos", () => {
  it("omite arrays vacíos y textos vacíos", () => {
    const p = stockParams({ ...BASE, q: "" });
    expect(p.deposito).toBeUndefined();
    expect(p.rubro).toBeUndefined();
    expect(p.q).toBeUndefined();
  });

  it("pasa el drill-down de la solapa con el nombre que espera la API", () => {
    const p = stockParams({ ...BASE, estado: "RiesgoQuiebre", estadosVenc: ["Vencido"], orden: "Valor" });
    // La clave repetida del backend es `estadoVenc`, en singular.
    expect(p).toMatchObject({ estado: "RiesgoQuiebre", estadoVenc: ["Vencido"], orden: "Valor" });
  });
});
