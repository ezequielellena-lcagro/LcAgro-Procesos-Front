import { describe, expect, it } from "vitest";
import type { AjusteDto } from "../types";
import { calcularOps } from "./use-arrastres";

function ajuste(id: number, cereal: string, tn: number, signo: "+" | "-" = "+", precioUsd: number | null = null): AjusteDto {
  return {
    id,
    campania: "2023-2024",
    cereal,
    tipo: "arrastre_inicial",
    tn,
    precioUsd,
    signo,
    nota: null,
    tnFirmadas: signo === "+" ? tn : -tn,
    fechaAlta: "2026-07-14T00:00:00Z",
  };
}

describe("calcularOps", () => {
  it("crea las celdas nuevas con valor, con su precio", () => {
    const ops = calcularOps([], [{ cereal: "Soja", tn: "3725", signo: "-", precio: "411" }]);
    expect(ops).toEqual([{ kind: "create", cereal: "Soja", tn: 3725, signo: "-", precio: 411 }]);
  });

  it("crea sin precio si la celda no lo tiene", () => {
    const ops = calcularOps([], [{ cereal: "Soja", tn: "100", signo: "+", precio: "" }]);
    expect(ops).toEqual([{ kind: "create", cereal: "Soja", tn: 100, signo: "+", precio: null }]);
  });

  it("actualiza si cambió tn, signo o precio", () => {
    const existentes = [ajuste(1, "Soja", 3725, "-", 411)];
    // sin cambios
    expect(calcularOps(existentes, [{ cereal: "Soja", tn: "3725", signo: "-", precio: "411" }])).toEqual([]);
    // cambió tn
    expect(calcularOps(existentes, [{ cereal: "Soja", tn: "4000", signo: "-", precio: "411" }])).toEqual([
      { kind: "update", id: 1, cereal: "Soja", tn: 4000, signo: "-", precio: 411 },
    ]);
    // cambió signo (pasa de ventas a compras)
    expect(calcularOps(existentes, [{ cereal: "Soja", tn: "3725", signo: "+", precio: "411" }])).toEqual([
      { kind: "update", id: 1, cereal: "Soja", tn: 3725, signo: "+", precio: 411 },
    ]);
    // cambió solo el precio
    expect(calcularOps(existentes, [{ cereal: "Soja", tn: "3725", signo: "-", precio: "420" }])).toEqual([
      { kind: "update", id: 1, cereal: "Soja", tn: 3725, signo: "-", precio: 420 },
    ]);
  });

  it("elimina la celda que se vacía o queda en 0 (ese cereal no arrastra)", () => {
    const existentes = [ajuste(1, "Soja", 3725)];
    expect(calcularOps(existentes, [{ cereal: "Soja", tn: "", signo: "+", precio: "" }])).toEqual([
      { kind: "delete", id: 1 },
    ]);
    expect(calcularOps(existentes, [{ cereal: "Soja", tn: "0", signo: "+", precio: "" }])).toEqual([
      { kind: "delete", id: 1 },
    ]);
  });

  it("ignora celdas vacías sin existente", () => {
    expect(calcularOps([], [{ cereal: "Maíz", tn: "", signo: "+", precio: "" }])).toEqual([]);
  });

  it("mezcla create / update / delete / skip en una pasada", () => {
    const existentes = [ajuste(1, "Maíz", 2831, "-", 223.01), ajuste(2, "Soja", 3725, "-", 411)];
    const ops = calcularOps(existentes, [
      { cereal: "Maíz", tn: "2831", signo: "-", precio: "223.01" }, // sin cambios → skip
      { cereal: "Soja", tn: "", signo: "-", precio: "" }, // vaciada → delete
      { cereal: "Trigo", tn: "917", signo: "+", precio: "298" }, // nueva (va a compras) → create
    ]);
    expect(ops).toEqual([
      { kind: "delete", id: 2 },
      { kind: "create", cereal: "Trigo", tn: 917, signo: "+", precio: 298 },
    ]);
  });
});
