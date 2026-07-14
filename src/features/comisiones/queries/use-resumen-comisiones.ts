import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ComisionResumenDto } from "../types";
import { comisionesKeys } from "./keys";

export interface ResumenComisionesFiltros {
  anio: number;
  mes: number;
  vendNro?: number;
}

/**
 * Resumen por vendedor del período (en vivo desde MacroGest, o con tasas congeladas si el mes ya
 * fue generado). La página siempre lo llama con `vendNro: undefined` para el panel de resumen y
 * para poblar el Select de vendedores del filtro.
 */
export function useResumenComisiones(filtros: ResumenComisionesFiltros) {
  return useQuery({
    queryKey: comisionesKeys.resumen(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<ComisionResumenDto>("/comisiones/resumen", {
        params: { anio: filtros.anio, mes: filtros.mes, vendNro: filtros.vendNro },
      });
      return data;
    },
  });
}
