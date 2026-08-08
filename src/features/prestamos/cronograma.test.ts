import { describe, expect, it } from "vitest";
import { aplicarCambio, totales, type FilaCuota } from "./cronograma";

function fila(over: Partial<FilaCuota> = {}): FilaCuota {
  return {
    nroCuota: 1,
    fechaVencimiento: "2026-11-09",
    capital: 31350,
    interes: 0,
    iva: 0,
    ...over,
  };
}

/**
 * El IVA se autocompleta al 12 % mientras se carga, pero el usuario tiene que poder pisarlo: los
 * préstamos con tasa subsidiada traen el IVA del cuadro de marcha del banco y no cumplen la regla.
 * La regla para distinguir es "si no lo tocaste, lo sigo calculando yo".
 */
describe("aplicarCambio", () => {
  it("autocompleta el IVA cuando se carga el interés", () => {
    const r = aplicarCambio(fila(), { interes: 2496.01 });

    expect(r.iva).toBe(299.52);
  });

  it("sigue recalculando el IVA mientras se corrige el interés", () => {
    // El IVA que hay es exactamente el sugerido del interés anterior ⇒ nadie lo tocó.
    const conIva = aplicarCambio(fila(), { interes: 2496.01 });

    const r = aplicarCambio(conIva, { interes: 8876.71 });

    expect(r.iva).toBe(1065.2);
  });

  it("no pisa el IVA que el usuario cargó a mano", () => {
    // Caso real: el préstamo Nación con TNA subsidiada trae el IVA del banco, que no es el 12 %.
    const manual = aplicarCambio(fila({ interes: 2496.01, iva: 299.52 }), { iva: 250 });

    const r = aplicarCambio(manual, { interes: 8876.71 });

    expect(r.iva).toBe(250);
  });

  it("deja el IVA en cero cuando el interés vuelve a cero", () => {
    const conIva = aplicarCambio(fila(), { interes: 2496.01 });

    const r = aplicarCambio(conIva, { interes: 0 });

    expect(r.iva).toBe(0);
  });

  it("no toca el IVA cuando lo que cambia es el capital", () => {
    const manual = aplicarCambio(fila({ interes: 100, iva: 42 }), { iva: 42 });

    const r = aplicarCambio(manual, { capital: 99999 });

    expect(r.iva).toBe(42);
    expect(r.capital).toBe(99999);
  });
});

describe("totales", () => {
  it("suma capital, interés, IVA y total", () => {
    const t = totales([
      fila({ capital: 31350, interes: 4251.58, iva: 510.19 }),
      fila({ nroCuota: 2, capital: 31350, interes: 3868.93, iva: 464.27 }),
    ]);

    expect(t.capital).toBe(62700);
    expect(t.interes).toBe(8120.51);
    expect(t.iva).toBe(974.46);
    expect(t.total).toBe(71794.97);
  });

  it("un cronograma vacío suma cero, no NaN", () => {
    expect(totales([])).toEqual({ capital: 0, interes: 0, iva: 0, total: 0 });
  });

  /** Sin redondear, 0.1 + 0.2 daría 0.30000000000000004 y el pie mostraría un centavo fantasma. */
  it("no arrastra el error binario de los decimales", () => {
    const t = totales([
      fila({ capital: 0.1, interes: 0, iva: 0 }),
      fila({ capital: 0.2, interes: 0, iva: 0 }),
    ]);

    expect(t.capital).toBe(0.3);
  });
});
