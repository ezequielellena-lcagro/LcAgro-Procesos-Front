import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  guardarMatrizSegmentacion,
  listarSegmentacion,
  obtenerMatrizSegmentacion,
  previsualizarMatrizSegmentacion,
} from "../api";
import type { MatrizSegmentacionRequest, SegmentacionFiltros } from "../types";
import { planificacionKeys } from "./keys";

export function useSegmentacion(filtros: SegmentacionFiltros) {
  return useQuery({
    queryKey: planificacionKeys.segmentacion(filtros),
    queryFn: () => listarSegmentacion(filtros),
    placeholderData: (previos, consultaPrevia) =>
      consultaPrevia?.queryKey[2] === filtros.campania ? previos : undefined,
  });
}

export function useMatrizSegmentacion(campania: string) {
  return useQuery({
    queryKey: planificacionKeys.matriz(campania),
    queryFn: () => obtenerMatrizSegmentacion(campania),
  });
}

/** Devuelve el impacto A/B/C/D sin cambiar la matriz vigente. */
export function usePrevisualizarMatrizSegmentacion() {
  return useMutation({
    mutationFn: previsualizarMatrizSegmentacion,
  });
}

export function useGuardarMatrizSegmentacion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: guardarMatrizSegmentacion,
    onSuccess: async (respuesta, request: MatrizSegmentacionRequest) => {
      queryClient.setQueryData(planificacionKeys.matriz(request.campania), respuesta.matriz);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: planificacionKeys.segmentacionesCampania(request.campania),
        }),
        // El tablero unificado incluye score, banda y resúmenes por segmento.
        queryClient.invalidateQueries({
          queryKey: planificacionKeys.tablerosCampania(request.campania),
        }),
        queryClient.invalidateQueries({
          queryKey: planificacionKeys.detallesCampania(request.campania),
        }),
      ]);
      toast.success(
        respuesta.sinCambios
          ? "La matriz ya estaba actualizada."
          : "Matriz de segmentación guardada.",
      );
    },
  });
}
