import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { FacturaContado } from "../types";
import { cuentasKeys } from "./keys";

/**
 * Detalle de las facturas de contado de una cuenta. `enabled` solo cuando hay cuenta seleccionada
 * (el diálogo pasa null mientras está cerrado). `umbralAvencer` es opcional: si no va, el backend
 * usa su valor por defecto.
 */
export function useFacturasContado(cuenta: number | null, umbralAvencer?: number) {
  return useQuery({
    queryKey: cuentasKeys.facturas(cuenta ?? 0, umbralAvencer),
    enabled: cuenta !== null,
    queryFn: async () => {
      const { data } = await apiClient.get<FacturaContado[]>(`/cuentas/${cuenta}/facturas-contado`, {
        params: { umbralAvencer },
      });
      return data;
    },
  });
}
