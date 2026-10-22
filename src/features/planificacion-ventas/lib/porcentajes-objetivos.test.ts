import { describe, expect, it } from "vitest";
import type { PorcentajeObjetivo } from "../types";
import {
  cambiosPorcentajes,
  entradaPorcentaje,
  erroresPorcentajes,
  validarPorcentaje,
} from "./porcentajes-objetivos";

const guardados: PorcentajeObjetivo[] = [
  { indicador: "facturacion", tipo: "crecimiento", porcentaje: 13, revision: 3, modificadoPor: "Erni", modificadoEl: null },
  { indicador: "margen_bruto", tipo: "nivel", porcentaje: 10, revision: 1, modificadoPor: "Erni", modificadoEl: null },
];

describe("porcentajes de objetivos", () => {
  it("lo guardado se muestra con coma decimal y lo no cargado arranca vacío y como crecimiento", () => {
    const conDecimal: PorcentajeObjetivo[] = [{ ...guardados[0], porcentaje: 12.5 }];
    expect(entradaPorcentaje(conDecimal, {}, "facturacion")).toEqual({ texto: "12,5", tipo: "crecimiento" });
    expect(entradaPorcentaje(guardados, {}, "market_share")).toEqual({ texto: "", tipo: "crecimiento" });
  });

  it("sólo manda lo que cambió, con la revisión vista; vaciar un guardado lo borra", () => {
    const cambios = cambiosPorcentajes(guardados, {
      facturacion: { texto: "15", tipo: "crecimiento" },
      margen_bruto: { texto: "", tipo: "nivel" },
      fertilizantes: { texto: "10", tipo: "crecimiento" },
      market_share: { texto: "", tipo: "crecimiento" },
    });
    expect(cambios).toEqual([
      { indicador: "facturacion", tipo: "crecimiento", porcentaje: 15, revisionEsperada: 3 },
      { indicador: "fertilizantes", tipo: "crecimiento", porcentaje: 10, revisionEsperada: 0 },
      { indicador: "margen_bruto", tipo: null, porcentaje: null, revisionEsperada: 1 },
    ]);
  });

  it("volver al valor guardado no cuenta como cambio, y cambiar sólo el tipo sí", () => {
    expect(cambiosPorcentajes(guardados, { facturacion: { texto: "13", tipo: "crecimiento" } })).toEqual([]);
    expect(cambiosPorcentajes(guardados, { margen_bruto: { texto: "10", tipo: "crecimiento" } })).toEqual([
      { indicador: "margen_bruto", tipo: "crecimiento", porcentaje: 10, revisionEsperada: 1 },
    ]);
  });

  it("valida número, decimales y rango según el tipo", () => {
    expect(validarPorcentaje("", "crecimiento")).toBeNull();
    expect(validarPorcentaje("12,5", "crecimiento")).toBeNull();
    expect(validarPorcentaje("-10", "crecimiento")).toBeNull();
    expect(validarPorcentaje("trece", "crecimiento")).toMatch(/número/);
    expect(validarPorcentaje("12,555", "crecimiento")).toMatch(/dos decimales/);
    expect(validarPorcentaje("120", "nivel")).toMatch(/0 a 100/);
    expect(validarPorcentaje("1500", "crecimiento")).toMatch(/-100 a 1000/);
    expect(erroresPorcentajes({ market_share: { texto: "120", tipo: "nivel" } })).toEqual({
      market_share: "Un nivel va de 0 a 100 %.",
    });
  });
});
