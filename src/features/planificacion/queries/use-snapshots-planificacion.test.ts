import { describe, expect, it } from "vitest";
import type { SnapshotPlanificacionDto } from "../types";
import { ordenarSnapshotsPlanificacion } from "./use-snapshots-planificacion";

function snapshot(id: number, capturadoEn: string): SnapshotPlanificacionDto {
  return {
    id,
    loteId: `lote-${id}`,
    fecha: capturadoEn.slice(0, 10),
    campania: "2025-2026",
    capturadoEn,
    versionEsquema: 1,
    productores: 1,
    bayerImportacionId: null,
    matrizRevision: 1,
    objetivosRevision: 1,
    sha256: "a".repeat(64),
  };
}

describe("listado de snapshots de planificación", () => {
  it("ordena las fotos de la más reciente a la más antigua sin mutar la respuesta", () => {
    const anterior = snapshot(1, "2026-08-26T08:30:00-03:00");
    const reciente = snapshot(2, "2026-08-27T08:30:00-03:00");
    const respuesta = [anterior, reciente];

    expect(ordenarSnapshotsPlanificacion(respuesta).map((item) => item.id)).toEqual([2, 1]);
    expect(respuesta.map((item) => item.id)).toEqual([1, 2]);
  });
});
