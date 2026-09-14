import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  CatalogosSemilleroDto,
  LoteDto,
  MovimientoDto,
  MovimientoFiltros,
  OrdenCargaDto,
  OrdenCargaFiltros,
  StockFiltros,
  StockSemilleroDto,
} from "../types";
import { semilleroKeys } from "./keys";

/** Stock por lote × ubicación, con KPIs partidos Propio/Cliente (R4.2/R4.3). */
export function useStockSemillero(filtros: StockFiltros) {
  return useQuery({
    queryKey: semilleroKeys.stock(filtros),
    queryFn: async () => (await apiClient.get<StockSemilleroDto>("/semillero/stock", { params: filtros })).data,
    placeholderData: keepPreviousData,
  });
}

/**
 * Todos los lotes con sus atributos completos, incluidos `duenioEditable`/`envaseYPesoEditables`
 * (que no viajan en las filas de stock). Se pide sólo al editar un lote existente.
 */
export function useLotesSemillero(habilitado: boolean) {
  return useQuery({
    queryKey: semilleroKeys.lotes(),
    queryFn: async () => (await apiClient.get<LoteDto[]>("/semillero/lotes")).data,
    enabled: habilitado,
  });
}

/** Variedades, ubicaciones y campañas, con la sugerida ya calculada por el backend (ADR-09). */
export function useCatalogosSemillero() {
  return useQuery({
    queryKey: semilleroKeys.catalogos(),
    queryFn: async () => (await apiClient.get<CatalogosSemilleroDto>("/semillero/catalogos")).data,
    staleTime: 10 * 60 * 1000, // casi no cambian
  });
}

/** Historial filtrable (R5.4). `habilitado` evita pedirlo antes de abrir la pestaña Movimientos. */
export function useMovimientosSemillero(filtros: MovimientoFiltros, habilitado: boolean) {
  return useQuery({
    queryKey: semilleroKeys.movimientos(filtros),
    queryFn: async () =>
      (await apiClient.get<MovimientoDto[]>("/semillero/movimientos", { params: filtros })).data,
    enabled: habilitado,
    placeholderData: keepPreviousData,
  });
}

export function useOrdenesCarga(filtros: OrdenCargaFiltros) {
  return useQuery({
    queryKey: semilleroKeys.ordenes(filtros),
    queryFn: async () => (await apiClient.get<OrdenCargaDto[]>("/semillero/ordenes", { params: filtros })).data,
    placeholderData: keepPreviousData,
  });
}
