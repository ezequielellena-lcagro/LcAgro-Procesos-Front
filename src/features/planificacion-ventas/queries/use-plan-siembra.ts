import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ContextoPlanificacion, PlanSiembraGrilla, VendedorComercial } from "../types";
import { planificacionKeys } from "./keys";

export function useContextoPlanificacion() {
  return useQuery({
    queryKey: planificacionKeys.contexto(),
    queryFn: async () =>
      (await apiClient.get<ContextoPlanificacion>("/planificacion-ventas/contexto")).data,
  });
}

export function useVendedoresPlanificacion(habilitado: boolean) {
  return useQuery({
    queryKey: planificacionKeys.vendedores(),
    queryFn: async () =>
      (await apiClient.get<VendedorComercial[]>("/planificacion-ventas/vendedores")).data,
    enabled: habilitado,
  });
}

export function usePlanSiembra(
  campania: string | undefined,
  vendedorId: number | undefined,
  incluirSinMovimiento: boolean,
  habilitado: boolean,
) {
  return useQuery({
    queryKey: planificacionKeys.plan(campania ?? "", vendedorId, incluirSinMovimiento),
    queryFn: async () =>
      (
        await apiClient.get<PlanSiembraGrilla>("/planificacion-ventas/plan-siembra", {
          params: { campania, vendedorId, incluirSinMovimiento },
        })
      ).data,
    enabled: habilitado && !!campania,
    placeholderData: keepPreviousData,
  });
}
