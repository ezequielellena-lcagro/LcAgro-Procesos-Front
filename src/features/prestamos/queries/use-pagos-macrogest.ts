import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { ConciliacionPagos, ConfirmarPagoItem } from "../types";
import { prestamosKeys } from "./keys";

/**
 * Los débitos de cuota que registró el banco, cruzados contra las cuotas pendientes. Pega contra
 * la base del cliente por VPN: sólo se dispara con la pestaña abierta y no reintenta en cadena.
 */
export function usePagosMacroGest(activa: boolean) {
  return useQuery({
    queryKey: prestamosKeys.pagosMacroGest(),
    queryFn: async () => {
      const { data } = await apiClient.get<ConciliacionPagos>("/prestamos/macrogest/pagos");
      return data;
    },
    enabled: activa,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** Aplica los pagos que el usuario eligió. Todo o nada: lo resuelve el backend. */
export function useConfirmarPagos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pagos: ConfirmarPagoItem[]) => {
      const { data } = await apiClient.post<{ imputados: number }>(
        "/prestamos/macrogest/pagos/confirmar",
        { pagos },
      );
      return data;
    },
    onSuccess: ({ imputados }) => {
      void qc.invalidateQueries({ queryKey: prestamosKeys.all });
      toast.success(
        imputados === 1 ? "Se imputó 1 cuota." : `Se imputaron ${imputados} cuotas.`,
      );
    },
  });
}
