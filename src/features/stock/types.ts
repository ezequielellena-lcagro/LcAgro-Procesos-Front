/** Estado de rotación del artículo (semáforo). Espeja EstadoStock del backend. */
export type EstadoStock = "Ok" | "RiesgoQuiebre" | "Inmovilizado";

/** Tipo de depósito según el catálogo. Espeja TipoDeposito del backend. */
export type TipoDeposito = "Propio" | "Consignado";

/** Una fila del listado (espeja StockItemDto). Cobertura/estado son a nivel artículo. */
export interface StockItem {
  deposito: number;
  depositoNombre: string;
  tipoDeposito: TipoDeposito;
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
  /** Stock mínimo del artículo (MacroGest, global). 0 = no cargado. */
  nivelMinimo: number;
  /** true si hay mínimo cargado y el stock del artículo no lo supera. */
  bajoMinimo: boolean;
}

/** KPIs del set filtrado completo (espeja TotalesStock). */
export interface TotalesStock {
  cantidadArticulos: number;
  valorUsdTotal: number;
  valorUsdPropio: number;
  valorUsdConsignado: number;
  valorUsdInmovilizado: number;
  pctInmovilizado: number;
  cantidadRiesgoQuiebre: number;
  cantidadBajoMinimo: number;
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

/** Un depósito del catálogo, para el filtro (espeja DepositoFiltroDto). */
export interface DepositoFiltro {
  codigo: number;
  nombre: string;
  tipo: TipoDeposito;
}

/** Opciones disponibles para los filtros (espeja StockFiltrosDto). */
export interface StockFiltrosResponse {
  depositos: DepositoFiltro[];
  rubros: RubroValor[];
}

/** Estado de los filtros que arma la página y consume el hook de listado. */
export interface StockFiltros {
  q?: string;
  deposito: number[];
  rubro: number[];
  tipo?: TipoDeposito;
  ventanaDias?: number;
  soloBajoMinimo?: boolean;
  page: number;
  pageSize: number;
}
