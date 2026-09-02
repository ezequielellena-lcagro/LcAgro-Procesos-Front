import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  confirmarBayer,
  confirmarBayerDesdeShare,
  confirmarPlanSiembra,
  obtenerEstadoShareBayer,
  previsualizarBayer,
  previsualizarBayerDesdeShare,
  previsualizarPlanSiembra,
} from "../api";
import { planificacionKeys } from "./keys";

/**
 * Importar es en dos pasos y a propósito: la vista previa no escribe nada y devuelve un token, y
 * recién la confirmación con ese token toca la base. Así nadie pisa el plan de una campaña sin ver
 * antes cuántas hectáreas y cuánto mercado quedan después.
 */

/**
 * La vigencia es desde cuándo rige esta versión del plan. El backend la exige y no acepta futuro,
 * así que se usa el momento de analizar. Vuelve en la respuesta y hay que reenviarla igual al
 * confirmar: forma parte del token.
 */
export function usePreviewPlanSiembra() {
  return useMutation({
    mutationFn: ({
      archivo,
      campania,
      resoluciones,
    }: {
      archivo: File;
      campania: string;
      resoluciones?: Record<string, number>;
    }) => previsualizarPlanSiembra(archivo, campania, new Date().toISOString(), resoluciones),
  });
}

export function useConfirmarPlanSiembra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      archivo,
      campania,
      vigenteDesde,
      tokenPreview,
      resoluciones,
    }: {
      archivo: File;
      campania: string;
      vigenteDesde: string;
      tokenPreview: string;
      resoluciones?: Record<string, number>;
    }) => confirmarPlanSiembra(archivo, campania, vigenteDesde, tokenPreview, resoluciones),
    onSuccess: async (resultado) => {
      // Cambia el mercado de cada productor: se recalculan tablero, segmentación y objetivos.
      await queryClient.invalidateQueries({ queryKey: planificacionKeys.all });
      toast.success(
        `Plan importado: ${resultado.productoresModificados.toLocaleString("es-AR")} productores, ` +
          `${resultado.mercadoDespues.hectareasTotales.toLocaleString("es-AR")} has.`,
      );
    },
  });
}

export function usePreviewBayer() {
  return useMutation({ mutationFn: previsualizarBayer });
}

export function useConfirmarBayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ archivo, tokenPreview }: { archivo: File; tokenPreview: string }) =>
      confirmarBayer(archivo, tokenPreview),
    onSuccess: async (resultado) => {
      await queryClient.invalidateQueries({ queryKey: planificacionKeys.all });
      toast.success(
        `Bayer importado: ${resultado.filasConProductor.toLocaleString("es-AR")} filas cruzadas ` +
          `sobre ${resultado.filas.toLocaleString("es-AR")}.`,
      );
    },
  });
}

/** El archivo de comisiones vive en el share ISO9001; si la app llega, no hay que subir nada. */
export function useEstadoShareBayer() {
  return useQuery({
    queryKey: [...planificacionKeys.all, "bayer", "share"] as const,
    queryFn: obtenerEstadoShareBayer,
    staleTime: 60 * 1000,
  });
}

export function usePreviewBayerShare() {
  return useMutation({ mutationFn: previsualizarBayerDesdeShare });
}

export function useConfirmarBayerShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tokenPreview: string) => confirmarBayerDesdeShare(tokenPreview),
    onSuccess: async (resultado) => {
      await queryClient.invalidateQueries({ queryKey: planificacionKeys.all });
      toast.success(
        `Bayer importado desde el share: ${resultado.filasConProductor.toLocaleString("es-AR")} ` +
          `filas cruzadas sobre ${resultado.filas.toLocaleString("es-AR")}.`,
      );
    },
  });
}
