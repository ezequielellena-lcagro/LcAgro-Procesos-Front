import { useQuery } from "@tanstack/react-query";
import { obtenerDetalleProductorTablero, obtenerTablero } from "../api";
import type { TableroFiltros } from "../types";
import { planificacionKeys } from "./keys";

/**
 * Conserva la página previa al paginar o filtrar dentro de una campaña, pero nunca muestra números
 * de una campaña anterior mientras vuela la nueva consulta.
 */
export function esMismaCampaniaTablero(
  queryKeyPrevia: readonly unknown[] | undefined,
  campania: string,
): boolean {
  return queryKeyPrevia?.[2] === campania;
}

export function useTableroPlanificacion(filtros: TableroFiltros) {
  return useQuery({
    queryKey: planificacionKeys.tablero(filtros),
    queryFn: () => obtenerTablero(filtros),
    placeholderData: (previos, queryPrevia) =>
      esMismaCampaniaTablero(queryPrevia?.queryKey, filtros.campania) ? previos : undefined,
  });
}

export function useProductorTableroDetalle(productorId: number | undefined, campania: string) {
  return useQuery({
    queryKey: planificacionKeys.detalle(productorId, campania),
    queryFn: () => obtenerDetalleProductorTablero(productorId!, campania),
    enabled: productorId !== undefined && productorId > 0 && campania.length > 0,
  });
}
