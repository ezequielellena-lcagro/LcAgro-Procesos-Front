/** Estado de rotación del artículo (semáforo). Espeja EstadoStock del backend. */
export type EstadoStock = "Ok" | "RiesgoQuiebre" | "Inmovilizado";

/** Una fila del listado (espeja StockItemDto). Cobertura/estado son a nivel artículo. */
export interface StockItem {
  deposito: number;
  codigoArticulo: number;
  nombreProducto: string;
  rubro: number;
  rubroDesc: string;
  unidad: string;
  stockActual: number;
  precioUsd: number;
  valorUsd: number;
  ventaDiaria: number;
  diasCobertura: number | null;
  estado: EstadoStock;
}

/** KPIs del set filtrado completo (espeja TotalesStock). */
export interface TotalesStock {
  cantidadArticulos: number;
  valorUsdTotal: number;
  valorUsdInmovilizado: number;
  pctInmovilizado: number;
  cantidadRiesgoQuiebre: number;
}

/** Valor USD acumulado por rubro (espeja RubroValorDto). */
export interface RubroValor {
  rubro: number;
  rubroDesc: string;
  valorUsd: number;
}

/** Respuesta del listado (espeja StockListadoDto): la página + totales/porRubro del filtro completo. */
export interface StockListado {
  items: StockItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  totales: TotalesStock;
  porRubro: RubroValor[];
}

/** Opciones disponibles para los filtros (espeja StockFiltrosDto). */
export interface StockFiltrosResponse {
  depositos: number[];
  rubros: RubroValor[];
}

/** Estado de los filtros que arma la página y consume el hook de listado. */
export interface StockFiltros {
  q?: string;
  deposito: number[];
  rubro: number[];
  ventanaDias?: number;
  page: number;
  pageSize: number;
}
