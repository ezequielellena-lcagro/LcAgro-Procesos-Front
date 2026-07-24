import type { EstadoStock, StockFiltros, TipoDeposito } from "./types";

/** "" = todos. El resto espeja EstadoStock. */
export type EstadoFiltro = EstadoStock | "";

/**
 * Filtros COMPARTIDOS por las solapas: definen el set base sobre el que se calculan los KPIs.
 * El estado de vencimiento NO está acá: lo reemplaza la solapa "Vencimientos".
 * `ventanaDias` es string porque es el valor crudo del input.
 *
 * `estado` se elige acá pero el backend lo aplica como drill-down (después del set base), así que
 * es el único de la barra que NO mueve los KPIs. La solapa Inmovilizado lo fija por preset.
 */
export interface FiltrosCompartidos {
  q: string;
  deposito: number[];
  rubro: number[];
  tipo: TipoDeposito | "";
  estado: EstadoFiltro;
  ventanaDias: string;
  soloBajoMinimo: boolean;
}

export const FILTROS_INICIALES: FiltrosCompartidos = {
  q: "",
  deposito: [],
  rubro: [],
  tipo: "",
  estado: "",
  ventanaDias: "90", // default del backend
  soloBajoMinimo: false,
};

/** Los filtros compartidos tal como los espera la API (los vacíos se omiten). */
export function filtrosAQuery(f: FiltrosCompartidos): Omit<StockFiltros, "page" | "pageSize"> {
  return {
    q: f.q || undefined,
    deposito: f.deposito,
    rubro: f.rubro,
    tipo: f.tipo || undefined,
    estado: f.estado || undefined,
    ventanaDias: f.ventanaDias ? Number(f.ventanaDias) : undefined,
    soloBajoMinimo: f.soloBajoMinimo,
  };
}
