import { afterEach, describe, expect, it, vi } from "vitest";
import { imprimirApaisado } from "./imprimir";

const hojasApaisadas = () =>
  [...document.head.querySelectorAll("style")].filter((s) => s.textContent?.includes("landscape"));

afterEach(() => {
  for (const s of hojasApaisadas()) s.remove();
  vi.restoreAllMocks();
});

/**
 * El reporte va apaisado, como la hoja del Excel: once columnas en vertical entran cortadas.
 *
 * La orientación se pide con una regla `@page`, que no admite selectores — no se puede escribir
 * "apaisado sólo esta vista" en el CSS. Por eso se inyecta al imprimir y se saca al terminar: si
 * quedara puesta, el resto de la app también saldría apaisado.
 */
describe("imprimirApaisado", () => {
  it("imprime", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});

    imprimirApaisado();

    expect(print).toHaveBeenCalled();
  });

  it("pide la hoja apaisada antes de imprimir", () => {
    vi.spyOn(window, "print").mockImplementation(() => {
      expect(hojasApaisadas()).toHaveLength(1);
    });

    imprimirApaisado();
  });

  /** Si la regla quedara puesta, el resto de la app también saldría apaisado. */
  it("saca la hoja apaisada al terminar", () => {
    vi.spyOn(window, "print").mockImplementation(() => {});

    imprimirApaisado();
    window.dispatchEvent(new Event("afterprint"));

    expect(hojasApaisadas()).toHaveLength(0);
  });

  /** Imprimir dos veces seguidas no deja dos reglas dando vueltas. */
  it("no acumula reglas al imprimir varias veces", () => {
    vi.spyOn(window, "print").mockImplementation(() => {});

    imprimirApaisado();
    window.dispatchEvent(new Event("afterprint"));
    imprimirApaisado();
    window.dispatchEvent(new Event("afterprint"));

    expect(hojasApaisadas()).toHaveLength(0);
  });
});
