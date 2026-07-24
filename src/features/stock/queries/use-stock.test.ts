import { describe, expect, it } from "vitest";
import type { StockFiltros } from "../types";
import { stockKeys } from "./keys";
import { mismoModoDeFila } from "./use-stock";

const BASE: StockFiltros = { deposito: [], rubro: [], page: 1, pageSize: 50 };
const porDeposito = (p: Partial<StockFiltros> = {}): StockFiltros => ({ ...BASE, ...p });
const consolidado = (p: Partial<StockFiltros> = {}): StockFiltros => ({ ...BASE, consolidado: true, ...p });

/**
 * El placeholder solo puede venir de una query del MISMO modo de fila. Si no, al clickear
 * "Stock global" la tabla consolidada dibuja las filas por depósito de la solapa anterior —GLIFOSATO
 * dos veces, 1.200 y 400, en vez de una fila de 1.600— sin ningún indicador de carga.
 */
describe("mismoModoDeFila", () => {
  it("paginar dentro de la misma solapa conserva el placeholder", () => {
    expect(mismoModoDeFila(stockKeys.list(porDeposito({ page: 1 })), porDeposito({ page: 2 }))).toBe(true);
    expect(mismoModoDeFila(stockKeys.list(consolidado({ page: 1 })), consolidado({ page: 2 }))).toBe(true);
  });

  it("pasar a la solapa consolidada descarta el placeholder", () => {
    expect(mismoModoDeFila(stockKeys.list(porDeposito()), consolidado())).toBe(false);
  });

  it("volver de la solapa consolidada también lo descarta", () => {
    expect(mismoModoDeFila(stockKeys.list(consolidado()), porDeposito())).toBe(false);
  });

  it("sin query previa no hay placeholder", () => {
    expect(mismoModoDeFila(undefined, porDeposito())).toBe(false);
  });

  it("consolidado ausente y consolidado false son el mismo modo", () => {
    expect(mismoModoDeFila(stockKeys.list(porDeposito({ consolidado: false })), porDeposito())).toBe(true);
  });

  it("cambiar un filtro compartido dentro del mismo modo conserva el placeholder", () => {
    expect(mismoModoDeFila(stockKeys.list(porDeposito()), porDeposito({ q: "glifo" }))).toBe(true);
  });
});
