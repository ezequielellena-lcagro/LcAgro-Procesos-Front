import { describe, expect, it } from "vitest";
import type { StockFilaDto } from "../types";
import {
  agruparElegibles,
  excedidos,
  filtrarElegibles,
  lotesElegibles,
  renglonesDeOtroCliente,
  totalesOrden,
  variedadesDeElegibles,
} from "./orden";

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

describe("filtrarElegibles", () => {
  const elegibles = lotesElegibles([
    fila({ loteId: 1, variedadId: 1, variedad: "DM 46E25", tratada: true }),
    fila({ loteId: 2, variedadId: 2, variedad: "NS 4309", tratada: false }),
    fila({ loteId: 3, variedadId: 1, variedad: "DM 46E25", envase: "Bolsa", pesoUnitarioKg: 40, fisico: 100 }),
  ]);
  const ids = (filtradas: { loteId: number }[]) => filtradas.map((e) => e.loteId);

  it("sin filtros devuelve todos los elegibles", () => {
    expect(ids(filtrarElegibles(elegibles, {}))).toEqual([1, 2, 3]);
  });

  it("filtra por variedad, tratamiento y envase, y los filtros se combinan", () => {
    expect(ids(filtrarElegibles(elegibles, { variedadId: 1 }))).toEqual([1, 3]);
    expect(ids(filtrarElegibles(elegibles, { tratada: false }))).toEqual([2, 3]);
    expect(ids(filtrarElegibles(elegibles, { envase: "Bolsa" }))).toEqual([3]);
    expect(ids(filtrarElegibles(elegibles, { variedadId: 1, tratada: false, envase: "BigBag" }))).toEqual([]);
  });
});

describe("variedadesDeElegibles", () => {
  it("devuelve cada variedad presente una sola vez, ordenada por nombre", () => {
    const elegibles = lotesElegibles([
      fila({ loteId: 1, variedadId: 2, variedad: "NS 4309" }),
      fila({ loteId: 2, variedadId: 1, variedad: "DM 46E25" }),
      fila({ loteId: 3, variedadId: 2, variedad: "NS 4309" }),
    ]);
    expect(variedadesDeElegibles(elegibles)).toEqual([
      { id: 1, nombre: "DM 46E25" },
      { id: 2, nombre: "NS 4309" },
    ]);
  });
});

describe("agruparElegibles", () => {
  it("agrupa por producto (variedad · tratamiento · envase · campaña) en un orden estable", () => {
    const grupos = agruparElegibles(
      lotesElegibles([
        fila({ loteId: 1, loteCodigo: "26S-010", variedadId: 2, variedad: "NS 4309" }),
        fila({ loteId: 2, loteCodigo: "26S-020", tratada: true }),
        fila({ loteId: 3, loteCodigo: "26S-030", envase: "Bolsa", pesoUnitarioKg: 40 }),
        fila({ loteId: 4, loteCodigo: "25S-040", campania: "2025-2026" }),
        fila({ loteId: 5, loteCodigo: "26S-050" }),
      ]),
    );
    expect(grupos.map((g) => g.etiqueta)).toEqual([
      "DM 46E25 · Sin tratar · BigBag · 2025-2026",
      "DM 46E25 · Sin tratar · BigBag · 2026-2027",
      "DM 46E25 · Sin tratar · Bolsa · 2026-2027",
      "DM 46E25 · Tratada · BigBag · 2026-2027",
      "NS 4309 · Sin tratar · BigBag · 2026-2027",
    ]);
    expect(grupos.map((g) => g.lotes.map((l) => l.loteId))).toEqual([[4], [5], [3], [2], [1]]);
  });

  it("dentro de cada grupo ordena por código de lote y después por ubicación", () => {
    const [grupo] = agruparElegibles(
      lotesElegibles([
        fila({ loteId: 2, loteCodigo: "26S-002", ubicacionId: 1, ubicacion: "G1-1" }),
        fila({ loteId: 1, loteCodigo: "26S-001", ubicacionId: 3, ubicacion: "PLANTA" }),
        fila({ loteId: 1, loteCodigo: "26S-001", ubicacionId: 2, ubicacion: "G1-2" }),
      ]),
    );
    expect(grupo.lotes.map((l) => `${l.loteCodigo} ${l.ubicacion}`)).toEqual([
      "26S-001 G1-2",
      "26S-001 PLANTA",
      "26S-002 G1-1",
    ]);
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
