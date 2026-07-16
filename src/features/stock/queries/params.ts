import type { StockFiltros } from "../types";

/** Filtros que viajan al backend en /stock y /stock/export (todo menos la paginación). */
export type StockQueryFiltros = Omit<StockFiltros, "page" | "pageSize">;

/**
 * Params comunes de `/stock` y `/stock/export`, para que el listado y el Excel bajen exactamente
 * el mismo set (incluido el preset de la solapa activa). Los vacíos se omiten (axios saltea los
 * `undefined`); los arrays viajan como clave repetida gracias a `paramsSerializer: { indexes: null }`.
 */
export function stockParams(f: StockQueryFiltros) {
  return {
    deposito: f.deposito.length ? f.deposito : undefined,
    rubro: f.rubro.length ? f.rubro : undefined,
    tipo: f.tipo,
    q: f.q || undefined,
    ventanaDias: f.ventanaDias,
    soloBajoMinimo: f.soloBajoMinimo || undefined,
    estado: f.estado,
    estadoVenc: f.estadosVenc?.length ? f.estadosVenc : undefined,
    orden: f.orden,
  };
}
