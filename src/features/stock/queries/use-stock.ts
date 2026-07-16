import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { StockFiltros, StockListado } from "../types";
import { stockKeys } from "./keys";
import { stockParams } from "./params";

export function useStock(filtros: StockFiltros) {
  return useQuery({
    queryKey: stockKeys.list(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<StockListado>("/stock", {
        params: {
          ...stockParams(filtros),
          page: filtros.page,
          pageSize: filtros.pageSize,
        },
        // El backend bindea `deposito=1&deposito=2` (clave repetida sin corchetes).
        paramsSerializer: { indexes: null },
      });
      return data;
    },
    placeholderData: keepPreviousData, // paginar sin parpadeo
  });
}
