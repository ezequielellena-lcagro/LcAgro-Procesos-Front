import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { StockFiltros, StockListado } from "../types";
import { stockKeys } from "./keys";
import { stockParams } from "./params";

/**
 * true si la query anterior devolvía filas del MISMO modo que la nueva: artículo × depósito, o
 * consolidado por artículo. Es lo que decide si sus datos sirven de placeholder.
 *
 * Con `keepPreviousData` a secas, cambiar de solapa cambia la queryKey y React Query respondía
 * `success` con los items de la solapa anterior: la tabla consolidada dibujaba filas POR DEPÓSITO
 * como si fueran el total de la empresa (GLIFOSATO 1.200 de San Jorge en vez de 1.600) durante todo
 * el vuelo del request, sin ningún indicador de carga. Al revés, las filas consolidadas quedaban
 * agrupadas bajo "Depósito 0 — Todos los depósitos". Son números falsos en la pantalla con la que se
 * decide si se puede vender.
 */
export function mismoModoDeFila(
  prevKey: readonly unknown[] | undefined,
  filtros: StockFiltros,
): boolean {
  const previos = prevKey?.[2] as StockFiltros | undefined;
  return previos !== undefined && !!previos.consolidado === !!filtros.consolidado;
}

export function useStock(filtros: StockFiltros) {
  return useQuery({
    queryKey: stockKeys.list(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<StockListado>("/stock", {
        params: {
          ...stockParams(filtros),
          page: filtros.page,
          pageSize: filtros.pageSize,
        },
        // El backend bindea `deposito=1&deposito=2` (clave repetida sin corchetes).
        paramsSerializer: { indexes: null },
      });
      return data;
    },
    // Paginar sin parpadeo DENTRO de la misma solapa; al cambiar de modo, sin placeholder (skeleton).
    placeholderData: (previos, queryPrevia) =>
      mismoModoDeFila(queryPrevia?.queryKey, filtros) ? previos : undefined,
  });
}
