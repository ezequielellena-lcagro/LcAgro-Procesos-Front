import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PosicionDto } from "../types";
import { posicionKeys } from "./keys";

export function usePosicion(campania: string | undefined, cereal?: string) {
  return useQuery({
    queryKey: posicionKeys.list(campania ?? "", cereal),
    queryFn: async () => {
      const { data } = await apiClient.get<PosicionDto[]>("/posicion", {
        params: { campania, cereal: cereal || undefined },
      });
      return data;
    },
    enabled: Boolean(campania),
    placeholderData: (prev) => prev, // al cambiar filtro, mantiene la data previa (sin parpadeo)
  });
}
