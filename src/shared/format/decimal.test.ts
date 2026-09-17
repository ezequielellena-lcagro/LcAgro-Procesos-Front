import { describe, expect, it } from "vitest";
import { parsearDecimalEsAr } from "./decimal";

describe("parsearDecimalEsAr", () => {
  it.each([
    ["1.200", 1200],
    ["1.200,5", 1200.5],
    ["1200.5", 1200.5],
    ["  1.200,50  ", 1200.5],
    ["-1.200,5", -1200.5],
    ["1.234.567,89", 1234567.89],
    ["0", 0],
  ])("interpreta %s como %s", (texto, esperado) => {
    expect(parsearDecimalEsAr(texto)).toBe(esperado);
  });

  it("distingue vacío de cero", () => {
    expect(parsearDecimalEsAr("")).toBeNull();
    expect(parsearDecimalEsAr("   ")).toBeNull();
  });

  it.each(["abc", "1.2.3", "1,2.3", "1 200", "1e3"])(
    "devuelve NaN para %s, que la celda marca como inválido",
    (texto) => {
      expect(Number.isNaN(parsearDecimalEsAr(texto))).toBe(true);
    },
  );
});
