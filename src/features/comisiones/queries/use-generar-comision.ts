import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { ComisionGeneracionDto } from "../types";
import { comisionesKeys } from "./keys";

export interface GenerarComisionInput {
  anio: number;
  mes: number;
  /** Reintenta aunque el período ya esté generado (el backend devuelve 409 si no se manda). */
  forzar?: boolean;
}

/**
 * Congela el % de comisión vigente en MacroGest para el período (snapshot inmutable, no afecta lo
 * ya facturado). Si el mes ya fue generado, el backend responde 409 salvo `forzar:true`; la página
 * maneja ese caso puntual con `onError` en el `mutate` para ofrecer "Regenerar" (el toast de error
 * genérico lo sigue mostrando el MutationCache global con el mensaje que manda el backend).
 */
export function useGenerarComision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GenerarComisionInput) => {
      const { data } = await apiClient.post<ComisionGeneracionDto>("/comisiones/generar", input);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: comisionesKeys.lists() });
      qc.invalidateQueries({ queryKey: comisionesKeys.resumenes() });
      toast.success(
        `Comisiones generadas: ${data.vendedoresCongelados} vendedor(es) congelado(s) para ${data.mes}/${data.anio}.`,
      );
    },
  });
}
