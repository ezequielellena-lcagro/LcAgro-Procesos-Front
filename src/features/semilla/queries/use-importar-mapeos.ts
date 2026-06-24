import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { ImporteMapeoResultado } from "../types";
import { semillaKeys } from "./keys";

/**
 * Sube la plantilla de mapeo curada. El backend valida cada fila (cultivo/variedad/categoría) y hace
 * upsert masivo; las filas vacías se omiten y las inválidas se reportan. Al terminar refresca todo.
 */
export function useImportarMapeos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post<ImporteMapeoResultado>("/semilla/mapeos/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: semillaKeys.all });
      toast.success(`Importado: ${r.mapeados} mapeado(s) de ${r.filasLeidas} fila(s) leída(s).`);
      if (r.errores.length > 0) {
        toast.warning(`${r.errores.length} fila(s) con problemas. Ej.: ${r.errores[0]}`);
      }
    },
  });
}
