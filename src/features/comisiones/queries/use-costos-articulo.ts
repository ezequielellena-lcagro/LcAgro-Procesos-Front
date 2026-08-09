import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CostoArticuloDto } from "../types";
import { comisionesKeys } from "./keys";

/**
 * Correcciones manuales de costo cargadas (todas, no paginadas: son pocas — un renglón por artículo
 * con costo mal cargado en MacroGest). El diálogo la usa para precargar la nota del artículo que se
 * está corrigiendo; por eso `enabled`, para no pedirla mientras el diálogo está cerrado.
 */
export function useCostosArticulo(enabled: boolean) {
  return useQuery({
    queryKey: comisionesKeys.costos(),
    queryFn: async () => {
      const { data } = await apiClient.get<CostoArticuloDto[]>("/comisiones/costos");
      return data;
    },
    enabled,
  });
}
