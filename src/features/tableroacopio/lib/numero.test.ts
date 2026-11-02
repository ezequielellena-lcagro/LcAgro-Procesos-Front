import { describe, expect, it } from "vitest";
import { parsearNumero } from "./numero";

describe("parsearNumero", () => {
  it("entiende coma decimal y punto de miles", () => {
    expect(parsearNumero("1,5")).toBe(1.5);
    expect(parsearNumero("100.000")).toBe(100_000);
    expect(parsearNumero("100.000,5")).toBe(100_000.5);
    expect(parsearNumero("1.5")).toBe(1.5);
  });

  it("vacío es sin valor; basura y negativos (si no se permiten) son inválidos", () => {
    expect(parsearNumero("  ")).toBeNull();
    expect(parsearNumero("abc")).toBeUndefined();
    expect(parsearNumero("-5")).toBeUndefined();
    expect(parsearNumero("-5", { negativos: true })).toBe(-5);
  });
});
