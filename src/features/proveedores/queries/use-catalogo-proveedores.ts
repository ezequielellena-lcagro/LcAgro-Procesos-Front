import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ProveedorCatalogoDto } from "../types";
import { proveedoresKeys } from "./keys";

/**
 * Proveedores de zona 20 activos para el combo. No depende de los filtros de la pantalla (el
 * universo no cambia con el mes base), así que se cachea un minuto y no se re-consulta al paginar.
 */
export function useCatalogoProveedores() {
  return useQuery({
    queryKey: proveedoresKeys.catalogo(),
    queryFn: async () => {
      const { data } = await apiClient.get<ProveedorCatalogoDto[]>("/proveedores/catalogo");
      return data;
    },
    staleTime: 60_000,
  });
}
