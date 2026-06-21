import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { posicionKeys } from "./keys";

export function useCampanias() {
  return useQuery({
    queryKey: posicionKeys.campanias(),
    queryFn: async () => {
      const { data } = await apiClient.get<string[]>("/posicion/campanias");
      return data;
    },
    staleTime: 30 * 60_000, // las campañas casi no cambian
  });
}
