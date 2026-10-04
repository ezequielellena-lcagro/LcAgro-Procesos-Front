import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CursorResumen, ResumenLogistica } from "../types";
export function useLogisticaResumen(
  filtrosAplicados: object,
  cursor: CursorResumen | undefined,
  version: number,
  enabled: boolean,
) {
  const client = useQueryClient();
  const consulta = useQuery({
    queryKey: ["logistica", "resumen", filtrosAplicados, cursor, version],
    enabled,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ResumenLogistica>("/logistica/resumen", {
          params: { ...filtrosAplicados, tamano: 50, ...cursor },
          signal,
        })
      ).data,
  });
  // Una consulta fallida con clave nueva pierde su placeholder en TanStack.
  // Conservamos el último corte completo de caché, marcado anterior por el panel.
  const anterior =
    consulta.isError && !consulta.data
      ? (client
          .getQueryCache()
          .findAll({ queryKey: ["logistica", "resumen"] })
          .filter((q) => q.state.data !== undefined)
          .reverse()
          .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)[0]?.state.data as
          | ResumenLogistica
          | undefined)
      : undefined;
  return { ...consulta, data: consulta.data ?? anterior };
}
