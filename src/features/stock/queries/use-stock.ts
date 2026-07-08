import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { StockFiltros, StockListado } from "../types";
import { stockKeys } from "./keys";

export function useStock(filtros: StockFiltros) {
  return useQuery({
    queryKey: stockKeys.list(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<StockListado>("/stock", {
        params: {
          deposito: filtros.deposito.length ? filtros.deposito : undefined,
          rubro: filtros.rubro.length ? filtros.rubro : undefined,
          tipo: filtros.tipo,
          q: filtros.q || undefined,
          ventanaDias: filtros.ventanaDias,
          soloBajoMinimo: filtros.soloBajoMinimo || undefined,
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
