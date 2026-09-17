import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ConsolidadoResponse } from "../types";
import { planificacionKeys } from "./keys";

export function useConsolidado(
  campania: string | undefined,
  vendedorId: number | undefined,
  sucursalId: number | undefined,
  habilitado: boolean,
) {
  return useQuery({
    queryKey: planificacionKeys.consolidado(campania ?? "", vendedorId, sucursalId),
    queryFn: async () =>
      (await apiClient.get<ConsolidadoResponse>("/planificacion-ventas/consolidado", {
        params: { campania, vendedorId, sucursalId },
      })).data,
    enabled: habilitado && !!campania,
    placeholderData: keepPreviousData,
  });
}
