import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ConciliacionMacroGest } from "../types";
import { prestamosKeys } from "./keys";

/**
 * Cruce contra MacroGest. Pega contra la base del cliente por VPN, así que sólo se dispara
 * cuando la pestaña está abierta (`enabled`) y el resultado se considera fresco por 5 minutos:
 * es un control, no un dato que cambie segundo a segundo.
 */
export function useConciliacion(activa: boolean) {
  return useQuery({
    queryKey: prestamosKeys.conciliacion(),
    queryFn: async () => {
      const { data } = await apiClient.get<ConciliacionMacroGest>(
        "/prestamos/macrogest/conciliacion",
      );
      return data;
    },
    enabled: activa,
    staleTime: 5 * 60 * 1000,
    // La VPN se cae seguido: reintentar en cadena sólo alarga la espera del usuario, que ya
    // tiene el botón de reintentar a la vista.
    retry: false,
  });
}
