import { describe, expect, it } from "vitest";
import { comprometido, detalleComprometido, detalleDisponible, haySobreventa } from "./disponibilidad";
import { fakeStockItem } from "./fakes";

const dicamba = fakeStockItem({
  deposito: 0,
  codigoArticulo: 10003,
  stockActual: 870,
  ventaFacturados: 600,
  ventaSinFacturar: 240,
  totalDisponible: 30,
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
