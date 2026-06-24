import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PosicionDto } from "../types";
import { posicionKeys } from "./keys";

export function usePosicion(
  campania: string | undefined,
  cereal?: string,
  precioMin = 50,
  precioMax = 700,
) {
  return useQuery({
    queryKey: posicionKeys.list(campania ?? "", cereal, precioMin, precioMax),
    queryFn: async () => {
      const { data } = await apiClient.get<PosicionDto[]>("/posicion", {
        params: { campania, cereal: cereal || undefined, precioMin, precioMax },
      });
      return data;
    },
    enabled: Boolean(campania),
    placeholderData: (prev) => prev, // al cambiar filtro, mantiene la data previa (sin parpadeo)
  });
}

/** Trae TODAS las campañas (sin filtro de campaña) para la vista "Detalle campañas". */
export function usePosicionDetalle(cereal?: string, precioMin = 50, precioMax = 700, enabled = true) {
  return useQuery({
    queryKey: posicionKeys.detalle(cereal, precioMin, precioMax),
    queryFn: async () => {
      const { data } = await apiClient.get<PosicionDto[]>("/posicion", {
        params: { cereal: cereal || undefined, precioMin, precioMax },
      });
      return data;
    },
    enabled,
    placeholderData: (prev) => prev,
  });
}
