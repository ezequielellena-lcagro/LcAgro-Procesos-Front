import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { ConciliacionMacroGest, Descarte, DescartarInput } from "../types";
import { prestamosKeys } from "./keys";

/**
 * Cruce contra MacroGest. Pega contra la base del cliente por VPN, así que sólo se dispara
 * cuando la pestaña está abierta (`enabled`) y el resultado se considera fresco por 5 minutos:
 * es un control, no un dato que cambie segundo a segundo.
 */
export function useConciliacion(activa: boolean) {
  return useQuery({
    queryKey: prestamosKeys.conciliacion(),
    queryFn: async () => {
      const { data } = await apiClient.get<ConciliacionMacroGest>(
        "/prestamos/macrogest/conciliacion",
      );
      return data;
    },
    enabled: activa,
    staleTime: 5 * 60 * 1000,
    // La VPN se cae seguido: reintentar en cadena sólo alarga la espera del usuario, que ya
    // tiene el botón de reintentar a la vista.
    retry: false,
  });
}

/**
 * Marca un movimiento del banco como "no corresponde". Pide motivo porque dentro de un año la
 * pregunta no va a ser qué está oculto, sino por qué.
 */
export function useDescartar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DescartarInput) => {
      const { data } = await apiClient.post<Descarte>("/prestamos/macrogest/descartes", input);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: prestamosKeys.conciliacion() });
      toast.success("Movimiento descartado del cruce.");
    },
  });
}

/** Deshace un descarte: el movimiento vuelve a aparecer. */
export function useQuitarDescarte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/prestamos/macrogest/descartes/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: prestamosKeys.conciliacion() });
      toast.success("Descarte deshecho: vuelve al cruce.");
    },
  });
}
