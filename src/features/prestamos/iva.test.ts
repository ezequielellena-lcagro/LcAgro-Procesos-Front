import { describe, expect, it } from "vitest";
import { ivaSugerido } from "./iva";

/**
 * Espeja `IvaFinanciero.Sugerido` del backend. Se duplica en el front a propósito: el editor de
 * cronograma tiene que autocompletar el IVA MIENTRAS se tipea, sin ida y vuelta al servidor.
 * Si las dos implementaciones se separaran, el usuario vería un número al cargar y otro al guardar.
 */
describe("ivaSugerido", () => {
  it("suma el 10,5 % de IVA más el 1,5 % de percepción", () => {
    expect(ivaSugerido(2496.01)).toBe(299.52);
  });

  it("redondea cada componente por separado, no el 12 % junto", () => {
    // 10,5 % → 932,05455 → 932,05  ·  1,5 % → 133,15065 → 133,15  ⇒ 1.065,20
    // El 12 % de una sola vez daría 1.065,2052 → 1.065,21: un centavo de más.
    expect(ivaSugerido(8876.71)).toBe(1065.2);
  });

  it("sin intereses no hay IVA", () => {
    // Media cartera son financiaciones de proveedor a tasa 0.
    expect(ivaSugerido(0)).toBe(0);
  });

  it("no devuelve NaN cuando el campo de interés está vacío", () => {
    expect(ivaSugerido(Number.NaN)).toBe(0);
  });
});
