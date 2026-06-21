import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { AjusteDto, AjusteInput } from "../types";
import { ajustesKeys, posicionKeys } from "./keys";

// Un ajuste cambia la POSICIÓN FINAL (y el dashboard): se invalidan las tres.
function useInvalidar(campania: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ajustesKeys.list(campania) });
    qc.invalidateQueries({ queryKey: posicionKeys.all });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useCrearAjuste(campania: string) {
  const invalidar = useInvalidar(campania);
  return useMutation({
    meta: { silentError: true }, // el form mapea errores por campo
    mutationFn: async (input: AjusteInput) => {
      const { data } = await apiClient.post<AjusteDto>("/ajustes", input);
      return data;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Ajuste creado.");
    },
  });
}

export function useEditarAjuste(campania: string) {
  const invalidar = useInvalidar(campania);
  return useMutation({
    meta: { silentError: true },
    mutationFn: async ({ id, input }: { id: number; input: AjusteInput }) => {
      const { data } = await apiClient.put<AjusteDto>(`/ajustes/${id}`, input);
      return data;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Ajuste actualizado.");
    },
  });
}

export function useEliminarAjuste(campania: string) {
  const invalidar = useInvalidar(campania);
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/ajustes/${id}`);
    },
    onSuccess: () => {
      invalidar();
      toast.success("Ajuste eliminado.");
    },
  });
}
