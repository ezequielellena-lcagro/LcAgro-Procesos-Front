/** Estado de rotación del artículo (semáforo). Espeja EstadoStock del backend. */
export type EstadoStock = "Ok" | "RiesgoQuiebre" | "Inmovilizado";

/** Tipo de depósito según el catálogo. Espeja TipoDeposito del backend. */
export type TipoDeposito = "Propio" | "Consignado";

/** Estado de vencimiento de un lote/artículo. Espeja EstadoVencimiento del backend. */
export type EstadoVencimiento = "SinFecha" | "Vencido" | "Critico" | "Alerta" | "Normal";

/** Semáforo de rotación por días en stock. Espeja SemaforoRotacion del backend. */
export type SemaforoRotacion = "SinDato" | "Verde" | "Amarillo" | "Rojo";

/** Orden del listado. Espeja OrdenStock del backend (ausente/inválido → Deposito). */
export type OrdenStock = "Deposito" | "Vencimiento" | "Valor";

/** Un lote del artículo en un depósito (espeja StockLoteDto). */
export interface StockLote {
  serie: string;
  stockActual: number;
  fechaIngreso: string | null;
  fechaVencimiento: string | null;
  diasParaVencer: number | null;
  estadoVenc: EstadoVencimiento;
  diasEnStock: number | null;
  semaforoRotacion: SemaforoRotacion;
}

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
  /** Mercadería comprada que todavía no ingresó al galpón. SUMA al disponible. */
  pedidosCompras: number;
  /** Vendido y facturado, pero todavía en el galpón. RESTA del disponible. */
  ventaFacturados: number;
  /** Vendido sin facturar, todavía en el galpón. RESTA del disponible. */
  ventaSinFacturar: number;
  /**
   * `stockActual + pedidosCompras − ventaFacturados − ventaSinFacturar`.
   * PUEDE SER NEGATIVO: es sobreventa real (MacroGest también la muestra en negativo), no se pisa en 0.
   */
  totalDisponible: number;
  ventaDiaria: number;
  /**
   * Días de cobertura sobre el stock FÍSICO del artículo. Dato secundario: sobrestima cuando parte
   * del stock ya está vendido y sin entregar.
   */
  diasCobertura: number | null;
  /**
   * Días de cobertura sobre el DISPONIBLE del artículo. Es el número honesto y el que clasifica
   * `estado`; es también el que muestra la tabla. Puede ser negativo (sobreventa).
   */
  diasCoberturaDisponible: number | null;
  estado: EstadoStock;
  /** Stock mínimo del artículo (MacroGest, global). 0 = no cargado. */
  nivelMinimo: number;
  /** true si hay mínimo cargado y el DISPONIBLE del artículo no lo supera. */
  bajoMinimo: boolean;
  /** Peor estado de vencimiento entre los lotes del artículo en este depósito. */
  estadoVenc: EstadoVencimiento;
  /** Fecha de vencimiento más temprana entre los lotes (ISO), o null. */
  proximoVencimiento: string | null;
  unidadesVencidas: number;
  unidadesCriticas: number;
  valorUsdVencido: number;
  diasEnStockMax: number | null;
  diasEnStockPromedio: number | null;
  semaforoRotacion: SemaforoRotacion;
  lotes: StockLote[];
}

/** KPIs del set filtrado completo (espeja TotalesStock). */
export interface TotalesStock {
  cantidadArticulos: number;
  valorUsdTotal: number;
  valorUsdPropio: number;
  valorUsdConsignado: number;
  valorUsdInmovilizado: number;
  /** Valor USD del stock que ya tiene dueño (vendido y sin entregar). */
  valorUsdComprometido: number;
  pctInmovilizado: number;
  cantidadRiesgoQuiebre: number;
  cantidadBajoMinimo: number;
  valorUsdVencido: number;
  valorUsdPorVencer: number;
  cantidadPorVencer: number;
  antiguedadPromedioDias: number | null;
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

/**
 * Estado de los filtros que arma la página y consume el hook de listado.
 *
 * Los filtros COMPARTIDOS (q/deposito/rubro/tipo/ventanaDias/soloBajoMinimo) definen el set base
 * sobre el que el backend calcula `totales`/`porRubro`. `estado`/`estadosVenc`/`orden` son el
 * drill-down de la solapa: afectan `items`/`total`, NO los KPIs.
 *
 * `estado` se elige en la barra de filtros de arriba, pero viaja igual como drill-down: el backend
 * lo aplica DESPUÉS del set base, así que los KPIs no se mueven al aislar un estado.
 */
export interface StockFiltros {
  q?: string;
  deposito: number[];
  rubro: number[];
  tipo?: TipoDeposito;
  ventanaDias?: number;
  soloBajoMinimo?: boolean;
  /** Vacío/ausente = sin filtro. Viaja como clave repetida (`estadoVenc=Vencido&estadoVenc=Critico`). */
  estadosVenc?: EstadoVencimiento[];
  estado?: EstadoStock;
  orden?: OrdenStock;
  /** true = una fila por artículo sumando todos los depósitos (solapa "Stock global"). */
  consolidado?: boolean;
  page: number;
  pageSize: number;
}
