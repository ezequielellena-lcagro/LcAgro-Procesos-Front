import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { CostoArticuloInput } from "../types";
import { comisionesKeys } from "./keys";

/**
 * Upsert de la corrección de costo de un artículo. Corregir el costo cambia la rentabilidad, el
 * margen y la comisión de TODOS los renglones de ese artículo, así que se invalidan las tres
 * familias de queries: el listado, el resumen por vendedor y la propia lista de correcciones.
 */
export function useGuardarCosto() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silentError: true }, // el form mapea errores por campo
    mutationFn: async ({ codigoArticulo, costoUsd, nota }: CostoArticuloInput) => {
      await apiClient.put(`/comisiones/costos/${codigoArticulo}`, { costoUsd, nota });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: comisionesKeys.lists() });
      qc.invalidateQueries({ queryKey: comisionesKeys.resumenes() });
      qc.invalidateQueries({ queryKey: comisionesKeys.costos() });
      toast.success("Costo corregido.");
    },
  });
}
