import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { DescartadoDto } from "../types";
import { posicionKeys } from "./keys";

/** Contratos con precio anómalo (fuera de rango) que la posición no cuenta: alerta para revisar en MacroGest. */
export function useDescartados(cereal?: string, precioMin = 50, precioMax = 700, enabled = true) {
  return useQuery({
    queryKey: posicionKeys.descartados(cereal, precioMin, precioMax),
    queryFn: async () => {
      const { data } = await apiClient.get<DescartadoDto[]>("/posicion/descartados", {
        params: { cereal: cereal || undefined, precioMin, precioMax },
      });
      return data;
    },
    enabled,
    placeholderData: (prev) => prev,
  });
}
