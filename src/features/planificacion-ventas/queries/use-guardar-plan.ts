import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { GuardarPlanRequest, GuardarPlanResponse } from "../types";
import { planificacionKeys } from "./keys";

export function useGuardarPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campania, request }: { campania: string; request: GuardarPlanRequest }) =>
      (
        await apiClient.put<GuardarPlanResponse>(
          "/planificacion-ventas/plan-siembra/" + campania,
          request,
        )
      ).data,
    onSuccess: async () => {
      const key = [...planificacionKeys.all, "plan-siembra"];
      await queryClient.invalidateQueries({ queryKey: key, refetchType: "none" });
      queryClient.removeQueries({ queryKey: key, type: "inactive" });
    },
  });
}

export function useActualizarDatosPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campania: string) => {
      await apiClient.post("/planificacion-ventas/datos-macrogest/actualizar", null, {
        params: { campania },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: planificacionKeys.all });
    },
  });
}
