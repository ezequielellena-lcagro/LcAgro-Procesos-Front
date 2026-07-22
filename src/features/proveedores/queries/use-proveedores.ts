import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ProveedoresFiltros, ProveedoresListado } from "../types";
import { proveedoresKeys } from "./keys";

export function useProveedores(filtros: ProveedoresFiltros) {
  return useQuery({
    queryKey: proveedoresKeys.list(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<ProveedoresListado>("/proveedores", {
        params: {
          anio: filtros.anio,
          mes: filtros.mes,
          proveedor: filtros.proveedor,
          q: filtros.q || undefined,
          page: filtros.page,
          pageSize: filtros.pageSize,
        },
      });
      return data;
    },
    placeholderData: keepPreviousData, // paginar y cambiar de mes sin parpadeo
  });
}
