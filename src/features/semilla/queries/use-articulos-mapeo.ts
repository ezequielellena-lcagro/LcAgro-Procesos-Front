import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ArticuloMapeoDto } from "../types";
import { semillaKeys } from "./keys";

/** Artículos de semilla con su estado de mapeo (confirmado o sugerido), para curar las equivalencias. */
export function useArticulosMapeo(enabled = true) {
  return useQuery({
    queryKey: semillaKeys.articulos(),
    queryFn: async () => {
      const { data } = await apiClient.get<ArticuloMapeoDto[]>("/semilla/articulos");
      return data;
    },
    enabled,
  });
}
