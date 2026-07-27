import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { StockCerealDto } from "../types";
import { stockCerealKeys } from "./keys";

/** Trae el reporte de stock físico de cereal (consolidado + detalle de planta 10 + alertas + totales). */
export function useStockCereal() {
  return useQuery({
    queryKey: stockCerealKeys.reporte(),
    queryFn: async () => {
      const { data } = await apiClient.get<StockCerealDto>("/stock-cereal");
      return data;
    },
  });
}
