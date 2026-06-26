import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { StockFiltrosResponse } from "../types";
import { stockKeys } from "./keys";

export function useStockFiltros() {
  return useQuery({
    queryKey: stockKeys.filtros(),
    queryFn: async () => {
      const { data } = await apiClient.get<StockFiltrosResponse>("/stock/filtros");
      return data;
    },
    staleTime: 5 * 60_000, // las opciones cambian poco
  });
}
