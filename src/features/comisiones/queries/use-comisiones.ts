import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PagedResult } from "@/shared/types/paged";
import type { ComisionDetalleDto, ComisionesFiltros } from "../types";
import { comisionesKeys } from "./keys";

export function useComisiones(filtros: ComisionesFiltros) {
  return useQuery({
    queryKey: comisionesKeys.list(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<PagedResult<ComisionDetalleDto>>("/comisiones", {
        params: {
          anio: filtros.anio,
          mes: filtros.mes,
          vendNro: filtros.vendNro,
          q: filtros.q || undefined,
          page: filtros.page,
          pageSize: filtros.pageSize,
        },
      });
      return data;
    },
    placeholderData: keepPreviousData, // paginar sin parpadeo
  });
}
