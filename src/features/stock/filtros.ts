import type { StockFiltros, TipoDeposito } from "./types";

/**
 * Filtros COMPARTIDOS por las 4 solapas: definen el set base sobre el que se calculan los KPIs.
 * El estado de vencimiento NO está acá: lo reemplaza la solapa "Vencimientos".
 * `ventanaDias` es string porque es el valor crudo del input.
 */
export interface FiltrosCompartidos {
  q: string;
  deposito: number[];
  rubro: number[];
  tipo: TipoDeposito | "";
  ventanaDias: string;
  soloBajoMinimo: boolean;
}

export const FILTROS_INICIALES: FiltrosCompartidos = {
  q: "",
  deposito: [],
  rubro: [],
  tipo: "",
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
    ventanaDias: f.ventanaDias ? Number(f.ventanaDias) : undefined,
    soloBajoMinimo: f.soloBajoMinimo,
  };
}
