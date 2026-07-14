import { describe, expect, it } from "vitest";
import type { AjusteDto } from "../types";
import { calcularOps } from "./use-arrastres";

function ajuste(id: number, cereal: string, tn: number, signo: "+" | "-" = "+"): AjusteDto {
  return {
    id,
    campania: "2023-2024",
    cereal,
    tipo: "arrastre_inicial",
    tn,
    precioUsd: null,
    signo,
    nota: null,
    tnFirmadas: signo === "+" ? tn : -tn,
    fechaAlta: "2026-07-14T00:00:00Z",
  };
}

describe("calcularOps", () => {
  it("crea las celdas nuevas con valor", () => {
    const ops = calcularOps([], [{ cereal: "Soja", tn: "3725", signo: "+" }]);
    expect(ops).toEqual([{ kind: "create", cereal: "Soja", tn: 3725, signo: "+" }]);
  });

  it("actualiza solo si cambió tn o signo", () => {
    const existentes = [ajuste(1, "Soja", 3725, "+")];
    expect(calcularOps(existentes, [{ cereal: "Soja", tn: "3725", signo: "+" }])).toEqual([]); // sin cambios
    expect(calcularOps(existentes, [{ cereal: "Soja", tn: "4000", signo: "+" }])).toEqual([
      { kind: "update", id: 1, cereal: "Soja", tn: 4000, signo: "+" },
    ]);
    expect(calcularOps(existentes, [{ cereal: "Soja", tn: "3725", signo: "-" }])).toEqual([
      { kind: "update", id: 1, cereal: "Soja", tn: 3725, signo: "-" },
    ]);
  });

  it("elimina la celda que se vacía o queda en 0", () => {
    const existentes = [ajuste(1, "Soja", 3725)];
    expect(calcularOps(existentes, [{ cereal: "Soja", tn: "", signo: "+" }])).toEqual([{ kind: "delete", id: 1 }]);
    expect(calcularOps(existentes, [{ cereal: "Soja", tn: "0", signo: "+" }])).toEqual([{ kind: "delete", id: 1 }]);
  });

  it("ignora celdas vacías sin existente", () => {
    expect(calcularOps([], [{ cereal: "Maíz", tn: "", signo: "+" }])).toEqual([]);
  });

  it("mezcla create / update / delete / skip en una pasada", () => {
    const existentes = [ajuste(1, "Maíz", 2831, "+"), ajuste(2, "Soja", 3725, "+")];
    const ops = calcularOps(existentes, [
      { cereal: "Maíz", tn: "2831", signo: "+" }, // sin cambios → skip
      { cereal: "Soja", tn: "", signo: "+" }, // vaciada → delete
      { cereal: "Trigo", tn: "100", signo: "-" }, // nueva → create
    ]);
    expect(ops).toEqual([
      { kind: "delete", id: 2 },
      { kind: "create", cereal: "Trigo", tn: 100, signo: "-" },
    ]);
  });
});
