import { describe, expect, it } from "vitest";
import type { StockFilaDto } from "../types";
import { excedidos, lotesElegibles, renglonesDeOtroCliente, totalesOrden } from "./orden";

function fila(over: Partial<StockFilaDto> = {}): StockFilaDto {
  const base: StockFilaDto = {
    loteId: 1,
    loteCodigo: "26S-001",
    campania: "2026-2027",
    especie: "Soja",
    variedadId: 1,
    variedad: "DM 46E25",
    envase: "BigBag",
    pesoUnitarioKg: 800,
    tratada: false,
    pg: 95,
    pmil: 150,
    observaciones: null,
    duenio: "Propio",
    clienteNumero: null,
    clienteDenominacion: null,
    ubicacionId: 1,
    ubicacion: "G1-6",
    fisico: 10,
    comprometido: 0,
    disponible: 10,
    kgDisponibles: 8000,
  };
  const f = { ...base, ...over };
  return { ...f, disponible: f.fisico - f.comprometido, kgDisponibles: (f.fisico - f.comprometido) * f.pesoUnitarioKg };
}

describe("lotesElegibles", () => {
  it("sólo ofrece lo que tiene disponible", () => {
    const elegibles = lotesElegibles([fila(), fila({ loteId: 2, fisico: 5, comprometido: 5 })]);
    expect(elegibles.map((e) => e.loteId)).toEqual([1]);
    expect(elegibles[0].maximo).toBe(10);
  });

  it("sin cliente elegido no aparece ningún lote de cliente (R4.4)", () => {
    const propio = fila({ loteId: 1 });
    const deClienteA = fila({ loteId: 2, duenio: "Cliente", clienteNumero: 500, clienteDenominacion: "Cliente A" });
    expect(lotesElegibles([propio, deClienteA]).map((e) => e.loteId)).toEqual([1]);
  });

  it("con un cliente elegido aparecen sus lotes pero no los de otro cliente", () => {
    const propio = fila({ loteId: 1 });
    const deClienteA = fila({ loteId: 2, duenio: "Cliente", clienteNumero: 500, clienteDenominacion: "Cliente A" });
    const deClienteB = fila({ loteId: 3, duenio: "Cliente", clienteNumero: 600, clienteDenominacion: "Cliente B" });
    const elegibles = lotesElegibles([propio, deClienteA, deClienteB], [], 500);
    expect(elegibles.map((e) => e.loteId)).toEqual([1, 2]);
  });

  it("al editar, lo que ya reservaba la misma orden vuelve a estar disponible para ella", () => {
    const agotadoPorEstaOrden = fila({ fisico: 4, comprometido: 4 });
    const elegibles = lotesElegibles([agotadoPorEstaOrden], [{ loteId: 1, ubicacionId: 1, cantidad: 4 }]);
    expect(elegibles).toHaveLength(1);
    expect(elegibles[0].maximo).toBe(4);
  });
});

describe("renglonesDeOtroCliente", () => {
  const filas = [
    fila({ loteId: 1, duenio: "Cliente", clienteNumero: 500 }),
    fila({ loteId: 2, duenio: "Cliente", clienteNumero: 600 }),
    fila({ loteId: 3, duenio: "Propio" }),
  ];

  it("marca los renglones de un cliente distinto del elegido", () => {
    const renglones = [
      { loteId: 1, ubicacionId: 1, cantidad: 2 },
      { loteId: 2, ubicacionId: 1, cantidad: 3 },
      { loteId: 3, ubicacionId: 1, cantidad: 1 },
    ];
    expect(renglonesDeOtroCliente(renglones, filas, 500)).toEqual([{ loteId: 2, ubicacionId: 1, cantidad: 3 }]);
  });

  it("sin cliente elegido, todos los renglones de cliente quedan marcados", () => {
    const renglones = [
      { loteId: 1, ubicacionId: 1, cantidad: 2 },
      { loteId: 3, ubicacionId: 1, cantidad: 1 },
    ];
    expect(renglonesDeOtroCliente(renglones, filas, undefined)).toEqual([{ loteId: 1, ubicacionId: 1, cantidad: 2 }]);
  });
});

describe("totalesOrden", () => {
  it("separa los kilos propios de los del cliente (ADR-13)", () => {
    const filas = [
      fila({ loteId: 1, pesoUnitarioKg: 800 }),
      fila({ loteId: 2, duenio: "Cliente", clienteNumero: 500, pesoUnitarioKg: 40, envase: "Bolsa" }),
    ];
    const renglones = [
      { loteId: 1, ubicacionId: 1, cantidad: 3 },
      { loteId: 2, ubicacionId: 1, cantidad: 10 },
    ];
    expect(totalesOrden(renglones, filas)).toEqual({ unidades: 13, kgPropio: 3 * 800, kgCliente: 10 * 40 });
  });
});

describe("excedidos", () => {
  it("marca los renglones que piden más que el máximo elegible", () => {
    const filas = [fila({ loteId: 1, fisico: 10, comprometido: 0 })];
    const elegibles = lotesElegibles(filas);
    expect(excedidos([{ loteId: 1, ubicacionId: 1, cantidad: 11 }], elegibles)).toEqual([
      { loteId: 1, ubicacionId: 1, cantidad: 11 },
    ]);
    expect(excedidos([{ loteId: 1, ubicacionId: 1, cantidad: 5 }], elegibles)).toEqual([]);
  });
});
