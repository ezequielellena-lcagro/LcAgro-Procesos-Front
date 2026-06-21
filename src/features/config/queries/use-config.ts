import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { ActualizarConfigItem, ConfigDto } from "../types";

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const { data } = await apiClient.get<ConfigDto[]>("/config");
      return data;
    },
  });
}

export function useGuardarConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: ActualizarConfigItem[]) => {
      await apiClient.put("/config", { items });
    },
    onSuccess: () => {
      // Cambiar parámetros afecta posición, cuentas y dashboard.
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["posicion"] });
      qc.invalidateQueries({ queryKey: ["cuentas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Configuración guardada.");
    },
  });
}
