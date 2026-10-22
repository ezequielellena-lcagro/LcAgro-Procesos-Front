import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { BaseObjetivosResponse, GuardarPorcentajesObjetivoRequest } from "../types";
import { planificacionKeys } from "./keys";

/** Base real de una campaña por vendedor. El servidor la cierra a gestión (403 para un vendedor). */
export function useBaseObjetivos(campania: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: planificacionKeys.baseObjetivos(campania ?? ""),
    queryFn: async () =>
      (await apiClient.get<BaseObjetivosResponse>("/planificacion-ventas/objetivos/base", {
        params: { campania },
      })).data,
    enabled: habilitado && !!campania,
    placeholderData: keepPreviousData,
  });
}

/**
 * Guarda los porcentajes de la campaña del objetivo. Resuelve recién cuando la base volvió a
 * leerse: así el borrador se limpia con las revisiones nuevas ya en pantalla y un segundo guardado
 * no sale con las viejas (409).
 */
export function useGuardarPorcentajesObjetivos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      campania,
      request,
    }: {
      campania: string;
      request: GuardarPorcentajesObjetivoRequest;
    }) => (await apiClient.put(`/planificacion-ventas/objetivos/${campania}/porcentajes`, request)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...planificacionKeys.all, "objetivos-base"] }),
  });
}
