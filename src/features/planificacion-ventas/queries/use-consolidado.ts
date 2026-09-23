import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ConsolidadoResponse } from "../types";
import { planificacionKeys } from "./keys";

/**
 * `vendedorIds` vacío = todas las carteras del alcance. Con uno o varios, el servidor recorta la
 * hoja entera (filas, subtotales, ajuste y TOTAL) a esos vendedores: el filtro NO se hace acá
 * porque el ajuste de redondeo sale de renglones que el front no tiene.
 * Los ids viajan como clave repetida (`?vendedorId=3&vendedorId=7`) gracias a `indexes: null`.
 */
export function useConsolidado(
  campania: string | undefined,
  vendedorIds: number[],
  sucursalId: number | undefined,
  habilitado: boolean,
) {
  return useQuery({
    queryKey: planificacionKeys.consolidado(campania ?? "", vendedorIds, sucursalId),
    queryFn: async () =>
      (await apiClient.get<ConsolidadoResponse>("/planificacion-ventas/consolidado", {
        params: { campania, vendedorId: vendedorIds, sucursalId },
        paramsSerializer: { indexes: null },
      })).data,
    enabled: habilitado && !!campania,
    placeholderData: keepPreviousData,
  });
}
