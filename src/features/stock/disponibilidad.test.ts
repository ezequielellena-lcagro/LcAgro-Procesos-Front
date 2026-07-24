import { describe, expect, it } from "vitest";
import {
  coberturaEsOptimista,
  comprometido,
  detalleCobertura,
  detalleComprometido,
  detalleDisponible,
  haySobreventa,
} from "./disponibilidad";
import { fakeStockItem } from "./fakes";

/** El caso real: 870 en el galpón, 840 con dueño. El disponible lo deriva el fixture: 30. */
const dicamba = fakeStockItem({
  deposito: 0,
  codigoArticulo: 10003,
  stockActual: 870,
  ventaFacturados: 600,
  ventaSinFacturar: 240,
  diasCobertura: 20,
  diasCoberturaDisponible: 1,
});

describe("comprometido", () => {
  it("suma facturado y sin facturar: los dos siguen en el galpón y ninguno se puede vender", () => {
    expect(comprometido(dicamba)).toBe(840);
  });
});

describe("haySobreventa", () => {
  it("es sobreventa solo cuando el disponible quedó negativo", () => {
    expect(haySobreventa(dicamba)).toBe(false);
    expect(haySobreventa({ ...dicamba, totalDisponible: 0 })).toBe(false);
    expect(haySobreventa({ ...dicamba, totalDisponible: -60 })).toBe(true);
  });
});

describe("detalleComprometido", () => {
  it("desglosa los dos números que la columna agrupa", () => {
    expect(detalleComprometido(dicamba)).toBe("Facturado: 600 · Sin facturar: 240");
  });
});

describe("detalleDisponible", () => {
  it("reconstruye la cuenta completa", () => {
    expect(detalleDisponible(dicamba)).toBe("870 en stock + 0 por llegar − 840 comprometido = 30");
  });

  it("avisa cuando el resultado es sobreventa", () => {
    const sobrevendido = { ...dicamba, totalDisponible: -60 };
    expect(detalleDisponible(sobrevendido)).toContain("= -60");
    expect(detalleDisponible(sobrevendido)).toContain("Sobreventa");
  });
});

describe("coberturaEsOptimista", () => {
  it("lo es cuando el físico promete más días que el disponible", () => {
    expect(coberturaEsOptimista(dicamba)).toBe(true);
  });

  it("no lo es sin nada comprometido: las dos coberturas coinciden", () => {
    expect(coberturaEsOptimista(fakeStockItem({ deposito: 0, codigoArticulo: 1 }))).toBe(false);
  });

  it("no lo es cuando lo por llegar hace que el disponible cubra MÁS que el físico", () => {
    const porLlegar = fakeStockItem({
      deposito: 0,
      codigoArticulo: 10004,
      stockActual: 0,
      pedidosCompras: 800,
      diasCobertura: 0,
      diasCoberturaDisponible: 53,
    });
    expect(coberturaEsOptimista(porLlegar)).toBe(false);
  });

  it("sin ventas no hay cobertura que comparar", () => {
    const sinVentas = fakeStockItem({
      deposito: 0,
      codigoArticulo: 1,
      diasCobertura: null,
      diasCoberturaDisponible: null,
    });
    expect(coberturaEsOptimista(sinVentas)).toBe(false);
  });
});

describe("detalleCobertura", () => {
  it("dice que el número es el del disponible y que con él se clasifica el Estado", () => {
    expect(detalleCobertura(dicamba)).toContain("DISPONIBLE del artículo");
    expect(detalleCobertura(dicamba)).toContain("semáforo de Estado");
  });

  it("cuenta cuánto prometía el stock físico cuando la diferencia existe", () => {
    expect(detalleCobertura(dicamba)).toContain("físico serían 20 días");
  });

  it("no menciona el físico cuando coinciden", () => {
    expect(detalleCobertura(fakeStockItem({ deposito: 0, codigoArticulo: 1 }))).not.toContain("físico");
  });

  it("explica el vacío cuando no hubo ventas en la ventana", () => {
    const sinVentas = fakeStockItem({ deposito: 0, codigoArticulo: 1, diasCoberturaDisponible: null });
    expect(detalleCobertura(sinVentas)).toContain("Sin ventas en la ventana");
  });
});
