import { describe, expect, it } from "vitest";
import type { BaseObjetivosResponse, IndicadoresBase, IndicadoresObjetivo } from "../types";
import { armarLineasObjetivos, campaniaAnterior, columnasObjetivos } from "./objetivos";

const indicadores = (facturacionUsd: number, extra: Partial<IndicadoresBase> = {}): IndicadoresBase => ({
  facturacionUsd,
  fertilizantesUsd: 0,
  semillaTrigoFiscalizadaBolsas: 0,
  semillaSojaFiscalizadaBolsas: 0,
  rentabilidadUsd: 0,
  margenBruto: null,
  mercadoUsd: null,
  marketShare: null,
  ...extra,
});

const sinObjetivo: IndicadoresObjetivo = {
  facturacionUsd: null,
  fertilizantesUsd: null,
  semillaTrigoFiscalizadaBolsas: null,
  semillaSojaFiscalizadaBolsas: null,
  rentabilidadUsd: null,
  margenBruto: null,
  marketShare: null,
};

const base = (extra: Partial<BaseObjetivosResponse> = {}): BaseObjetivosResponse => ({
  campania: "2025-2026",
  campaniaObjetivo: "2026-2027",
  datosMacroGestAl: null,
  vendedores: [
    { vendedorId: 2, vendedor: "Vendedor Dos", sucursal: "Sur", indicadores: indicadores(300), objetivo: sinObjetivo },
    { vendedorId: 1, vendedor: "Vendedor Uno", sucursal: null, indicadores: indicadores(100), objetivo: sinObjetivo },
  ],
  fueraDeCarteras: indicadores(0),
  objetivoFueraDeCarteras: sinObjetivo,
  ajusteRedondeoUsd: 0,
  total: indicadores(400),
  objetivoTotal: sinObjetivo,
  porcentajes: [],
  porcentajesEditables: true,
  ...extra,
});

describe("base de objetivos", () => {
  it("la campaña base es la anterior a la de los objetivos", () => {
    expect(campaniaAnterior("2026-2027")).toBe("2025-2026");
  });

  it("respeta el orden del servidor y oculta fuera y ajuste cuando no suman nada", () => {
    const lineas = armarLineasObjetivos(base());
    expect(lineas.map((linea) => linea.etiqueta)).toEqual(["Vendedor Dos", "Vendedor Uno", "TOTAL"]);
  });

  it("muestra fuera de carteras y el ajuste de redondeo cuando existen", () => {
    const lineas = armarLineasObjetivos(base({
      fueraDeCarteras: indicadores(0, { fertilizantesUsd: 5 }),
      ajusteRedondeoUsd: 0.01,
    }));
    expect(lineas.map((linea) => linea.tipo)).toEqual(["vendedor", "vendedor", "fuera", "ajuste", "total"]);
    const facturacion = columnasObjetivos().find((columna) => columna.key === "facturacion")!;
    expect(facturacion.get(lineas[3])).toBe(0.01);
    // El ajuste sólo tiene importe de facturación: el resto queda sin dato.
    const fertilizantes = columnasObjetivos().find((columna) => columna.key === "fertilizantes")!;
    expect(fertilizantes.get(lineas[3])).toBeNull();
  });

  it("los porcentajes viajan como fracción y se muestran sobre 100", () => {
    const [linea] = armarLineasObjetivos(base({
      vendedores: [{
        vendedorId: 1,
        vendedor: "Vendedor Uno",
        sucursal: null,
        indicadores: indicadores(100, { margenBruto: 0.085, marketShare: null }),
        objetivo: sinObjetivo,
      }],
    }));
    const columna = (key: string) => columnasObjetivos().find((item) => item.key === key)!;
    expect(columna("margen").get(linea)).toBeCloseTo(8.5);
    expect(columna("marketShare").get(linea)).toBeNull();
  });

  it("la vista objetivo muestra el objetivo con las mismas columnas, sin mercado ni ajuste", () => {
    const lineas = armarLineasObjetivos(base({
      vendedores: [{
        vendedorId: 1,
        vendedor: "Vendedor Uno",
        sucursal: null,
        indicadores: indicadores(100),
        objetivo: { ...sinObjetivo, facturacionUsd: 113, margenBruto: 0.1 },
      }],
      ajusteRedondeoUsd: 0.01,
    }));
    const columnas = columnasObjetivos("objetivo");
    const columna = (key: string) => columnas.find((item) => item.key === key)!;
    expect(columnas.map((item) => item.key)).not.toContain("mercado");
    expect(columna("facturacion").get(lineas[0])).toBe(113);
    expect(columna("margen").get(lineas[0])).toBeCloseTo(10);
    expect(columna("fertilizantes").get(lineas[0])).toBeNull();
    const ajuste = lineas.find((linea) => linea.tipo === "ajuste")!;
    expect(columna("facturacion").get(ajuste)).toBeNull();
  });
});
