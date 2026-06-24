import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PagedResult } from "@/shared/types/paged";
import type { CuentaDto, CuentasFiltros } from "../types";
import { cuentasKeys } from "./keys";

export function useCuentas(filtros: CuentasFiltros) {
  return useQuery({
    queryKey: cuentasKeys.list(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<PagedResult<CuentaDto>>("/cuentas", {
        params: {
          q: filtros.q || undefined,
          vendNro: filtros.vendNro,
          minUsd: filtros.minUsd,
          page: filtros.page,
          pageSize: filtros.pageSize,
        },
      });
      return data;
    },
    placeholderData: keepPreviousData, // paginar sin parpadeo
  });
}
