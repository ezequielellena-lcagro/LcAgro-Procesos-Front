import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { SemillaFiltros, VentaSemillaDto } from "../types";
import { semillaKeys } from "./keys";

/** Ventas de semilla del mes/cultivo, ya normalizadas al formato Sembra. */
export function useVentasSemilla(filtros: SemillaFiltros) {
  return useQuery({
    queryKey: semillaKeys.ventas(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<VentaSemillaDto[]>("/semilla/ventas", {
        params: { anio: filtros.anio, mes: filtros.mes, cultivo: filtros.cultivo },
      });
      return data;
    },
    placeholderData: keepPreviousData, // cambiar de mes/cultivo sin parpadeo
  });
}
