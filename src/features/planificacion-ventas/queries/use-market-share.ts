import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  GuardarMarketShareRequest,
  GuardarMarketShareResponse,
  MarketShareResponse,
} from "../types";
import { planificacionKeys } from "./keys";

export function useMarketShare(campania: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: planificacionKeys.marketShare(campania ?? ""),
    queryFn: async () =>
      (await apiClient.get<MarketShareResponse>("/planificacion-ventas/market-share/" + campania))
        .data,
    enabled: habilitado && !!campania,
    placeholderData: keepPreviousData,
  });
}

export function useGuardarMarketShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      campania,
      request,
    }: {
      campania: string;
      request: GuardarMarketShareRequest;
    }) =>
      (
        await apiClient.put<GuardarMarketShareResponse>(
          "/planificacion-ventas/market-share/" + campania,
          request,
        )
      ).data,
    onSuccess: () => {
      for (const recurso of ["market-share", "plan-siembra", "consolidado"]) {
        const key = [...planificacionKeys.all, recurso];
        // El GET derivado puede tardar o fallar: el PUT confirmado no depende de ese GET.
        void queryClient.invalidateQueries({
          queryKey: key,
          refetchType: recurso === "market-share" ? "none" : "active",
        });
        queryClient.removeQueries({ queryKey: key, type: "inactive" });
      }
    },
  });
}
