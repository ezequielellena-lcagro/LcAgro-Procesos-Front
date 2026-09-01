import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { StockCerealDto } from "../types";
import { stockCerealKeys } from "./keys";

/**
 * Trae el reporte de stock físico de cereal (consolidado + detalle de planta 10 + alertas + totales).
 * Sin campaña el backend devuelve la foto completa de hoy y, con ella, la lista de campañas
 * disponibles que alimenta el selector.
 */
export function useStockCereal(campania?: string) {
  return useQuery({
    queryKey: stockCerealKeys.reporte(campania),
    queryFn: async () => {
      const { data } = await apiClient.get<StockCerealDto>("/stock-cereal", {
        params: campania ? { campania } : undefined,
      });
      return data;
    },
  });
}
