import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ResumenFiltros, ResumenPrestamos } from "../types";
import { prestamosKeys } from "./keys";

/**
 * Resumen banco × período. Lo calcula el backend a partir del mismo calendario que alimenta la
 * grilla — no se arma en el cliente — para que la pantalla y el Excel exportado digan lo mismo.
 */
export function useResumen(filtros: ResumenFiltros, activa: boolean) {
  return useQuery({
    queryKey: prestamosKeys.resumen(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<ResumenPrestamos>("/prestamos/resumen", {
        params: filtros,
      });
      return data;
    },
    enabled: activa,
    placeholderData: keepPreviousData, // cambiar de agrupación sin parpadeo
  });
}
