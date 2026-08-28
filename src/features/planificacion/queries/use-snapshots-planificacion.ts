import { useQuery } from "@tanstack/react-query";
import { listarSnapshotsPlanificacion } from "../api";
import type { SnapshotPlanificacionDto } from "../types";
import { planificacionKeys } from "./keys";

export function ordenarSnapshotsPlanificacion(
  snapshots: SnapshotPlanificacionDto[],
): SnapshotPlanificacionDto[] {
  return snapshots.toSorted(
    (a, b) => Date.parse(b.capturadoEn) - Date.parse(a.capturadoEn),
  );
}

export function useSnapshotsPlanificacion(campania: string) {
  return useQuery({
    queryKey: planificacionKeys.listadoSnapshots(campania),
    queryFn: () => listarSnapshotsPlanificacion({ campania }),
    select: ordenarSnapshotsPlanificacion,
    enabled: campania.length > 0,
  });
}
