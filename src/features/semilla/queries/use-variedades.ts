import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CultivoSemilla } from "../types";
import { semillaKeys } from "./keys";

/** Cultivares INASE válidos de un cultivo (para el desplegable del mapeo). Casi no cambian. */
export function useVariedades(cultivo: CultivoSemilla | undefined) {
  return useQuery({
    queryKey: semillaKeys.variedades(cultivo as CultivoSemilla),
    queryFn: async () => {
      const { data } = await apiClient.get<string[]>("/semilla/variedades", {
        params: { cultivo },
      });
      return data;
    },
    enabled: !!cultivo,
    staleTime: 30 * 60_000,
  });
}
