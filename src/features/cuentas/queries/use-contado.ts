import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Contado, ContadoFiltros } from "../types";
import { cuentasKeys } from "./keys";

/**
 * Facturas de contado impagas (vencidas y a vencer), agrupadas vendedor → cuenta → factura.
 * `enabled` evita pegarle a la API mientras la solapa no está activa.
 */
export function useContado(filtros: ContadoFiltros, enabled: boolean) {
  return useQuery({
    queryKey: cuentasKeys.contado(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<Contado>("/cuentas/contado", {
        params: {
          vendNro: filtros.vendNro,
          minUsd: filtros.minUsd,
        },
      });
      return data;
    },
    enabled,
  });
}
