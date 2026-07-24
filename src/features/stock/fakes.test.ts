import { describe, expect, it } from "vitest";
import { fakeStockItem } from "./fakes";

/**
 * Los fixtures de Stock tienen que poder describir SOLO filas que el backend podría emitir: si
 * `totalDisponible` se pudiera poner a mano sin tocar los sumandos, un test de sobreventa pasaría
 * pintando de rojo un campo inventado en vez de ejercitar la aritmética del contrato.
 */
describe("fakeStockItem", () => {
  it("deriva el disponible con la fórmula del backend", () => {
    const item = fakeStockItem({
      deposito: 0,
      codigoArticulo: 10003,
      stockActual: 870,
      ventaFacturados: 600,
      ventaSinFacturar: 240,
    });
    expect(item.totalDisponible).toBe(30);
  });

  it("suma lo que viene por llegar", () => {
    const item = fakeStockItem({ deposito: 0, codigoArticulo: 1, stockActual: 0, pedidosCompras: 800 });
    expect(item.totalDisponible).toBe(800);
  });

  it("deja el disponible NEGATIVO cuando lo vendido supera las existencias", () => {
    const item = fakeStockItem({
      deposito: 45,
      codigoArticulo: 10080,
      stockActual: 90,
      ventaFacturados: 120,
      ventaSinFacturar: 30,
    });
    expect(item.totalDisponible).toBe(-60);
  });

  it("permite forzar el disponible como escape hatch explícito", () => {
    expect(fakeStockItem({ deposito: 0, codigoArticulo: 1, totalDisponible: -5 }).totalDisponible).toBe(-5);
  });

  it("sin nada comprometido, la cobertura del disponible es la del físico", () => {
    const item = fakeStockItem({ deposito: 0, codigoArticulo: 1, diasCobertura: 97 });
    expect(item.diasCoberturaDisponible).toBe(97);
  });

  it("respeta un diasCoberturaDisponible en null puesto a propósito", () => {
    const item = fakeStockItem({ deposito: 0, codigoArticulo: 1, diasCoberturaDisponible: null });
    expect(item.diasCoberturaDisponible).toBeNull();
  });
});
