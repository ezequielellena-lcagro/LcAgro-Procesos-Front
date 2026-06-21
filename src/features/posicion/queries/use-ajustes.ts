import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AjusteDto } from "../types";
import { ajustesKeys } from "./keys";

export function useAjustes(campania: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ajustesKeys.list(campania ?? ""),
    queryFn: async () => {
      const { data } = await apiClient.get<AjusteDto[]>("/ajustes", { params: { campania } });
      return data;
    },
    enabled: Boolean(campania) && enabled,
  });
}
