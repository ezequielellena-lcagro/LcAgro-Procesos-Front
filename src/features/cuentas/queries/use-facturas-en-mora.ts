import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { FacturasEnMora, FacturasMoraFiltros } from "../types";
import { cuentasKeys } from "./keys";

/**
 * Facturas de contado vencidas y sin cancelar, agrupadas vendedor → cuenta → factura.
 * `enabled` evita pegarle a la API mientras la solapa no está activa.
 */
export function useFacturasEnMora(filtros: FacturasMoraFiltros, enabled: boolean) {
  return useQuery({
    queryKey: cuentasKeys.mora(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<FacturasEnMora>("/cuentas/facturas-en-mora", {
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
