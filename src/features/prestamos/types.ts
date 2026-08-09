/**
 * Préstamos bancarios. Espeja los DTOs de `LcAgro.Application.Prestamos`.
 *
 * Es la única pantalla del sistema cuya fuente de verdad es NUESTRA base: las demás leen MacroGest.
 * El modelo tiene dos niveles —la operación (`Prestamo`) y sus cuotas (`PrestamoCuota`)— y esa es
 * justamente la relación que el Excel de Administración no tenía: ahí cada fila era un vencimiento
 * suelto, y al pagarse se borraba.
 */

export type Moneda = "ARS" | "USD";
export type TipoPrestamo = "Prestamo" | "FinanciacionProveedor" | "Leasing";
export type EstadoPrestamo = "Vigente" | "Cancelado" | "Refinanciado" | "Anulado";
export type EstadoCuota = "Pendiente" | "Pagada" | "Anulada";

/** Los valores son la cantidad de meses entre vencimientos (0 = pago único). */
export type Periodicidad =
  | "Unico"
  | "Mensual"
  | "Bimestral"
  | "Trimestral"
  | "Cuatrimestral"
  | "Semestral"
  | "Anual"
  | "Irregular";

export const PERIODICIDADES: { valor: Periodicidad; etiqueta: string }[] = [
  { valor: "Unico", etiqueta: "Pago único" },
  { valor: "Mensual", etiqueta: "Mensual" },
  { valor: "Bimestral", etiqueta: "Bimestral" },
  { valor: "Trimestral", etiqueta: "Trimestral" },
  { valor: "Cuatrimestral", etiqueta: "Cuatrimestral" },
  { valor: "Semestral", etiqueta: "Semestral" },
  { valor: "Anual", etiqueta: "Anual" },
  { valor: "Irregular", etiqueta: "Irregular (fechas a mano)" },
];

export const TIPOS: { valor: TipoPrestamo; etiqueta: string }[] = [
  { valor: "Prestamo", etiqueta: "Préstamo" },
  { valor: "FinanciacionProveedor", etiqueta: "Financiación de proveedor" },
  { valor: "Leasing", etiqueta: "Leasing" },
];

/** Una cuota del cronograma. `total` lo calcula el backend (capital + interés + IVA). */
export interface CuotaDto {
  id: number;
  nroCuota: number;
  fechaVencimiento: string; // yyyy-MM-dd
  capital: number;
  interes: number;
  iva: number;
  total: number;
  estado: EstadoCuota;
  fechaPago: string | null;
  importePagado: number | null;
  observacion: string | null;
}

/** Una operación con su cronograma completo. */
export interface PrestamoDetalleDto {
  id: number;
  bancoId: number;
  banco: string;
  sucursal: string | null;
  lineaCreditoId: number;
  linea: string;
  nroOperacion: string | null;
  moneda: Moneda;
  tipo: TipoPrestamo;
  capitalOriginal: number | null;
  fechaOtorgamiento: string | null;
  cantidadCuotas: number;
  periodicidad: Periodicidad;
  tasaNominalAnual: number | null;
  estado: EstadoPrestamo;
  observaciones: string | null;
  saldoTotal: number;
  capitalAdeudado: number;
  cuotasPagadas: number;
  proximoVencimiento: string | null;
  cuotas: CuotaDto[];
  /** Avisos que no impidieron guardar (ej. el capital de las cuotas no cierra con el original). */
  advertencias: string[];
}

/** Fila de la pestaña "Operaciones": el resumen por préstamo que la planilla nunca pudo dar. */
export interface PrestamoListadoDto {
  id: number;
  banco: string;
  sucursal: string | null;
  linea: string;
  nroOperacion: string | null;
  moneda: Moneda;
  tipo: TipoPrestamo;
  capitalOriginal: number | null;
  fechaOtorgamiento: string | null;
  periodicidad: Periodicidad;
  tasaNominalAnual: number | null;
  cuotasPagadas: number;
  cantidadCuotas: number;
  saldoTotal: number;
  capitalAdeudado: number;
  proximoVencimiento: string | null;
  estado: EstadoPrestamo;
}

/** Fila de la pestaña "Vencimientos" — el equivalente a la planilla actual. */
export interface VencimientoDto {
  cuotaId: number;
  prestamoId: number;
  fechaVencimiento: string;
  banco: string;
  sucursal: string | null;
  linea: string;
  nroOperacion: string | null;
  nroCuota: number;
  cantidadCuotas: number;
  capital: number;
  interes: number;
  iva: number;
  total: number;
  tasaNominalAnual: number | null;
  estado: EstadoCuota;
  /** Pendiente y con el vencimiento pasado: se marca en rojo. */
  vencida: boolean;
}

/** El calendario con sus totales al pie, como la fila TOTAL del Excel. */
export interface VencimientosDto {
  moneda: Moneda;
  items: VencimientoDto[];
  totalCapital: number;
  totalInteres: number;
  totalIva: number;
  totalTotal: number;
}

export interface CatalogoItemDto {
  id: number;
  nombre: string;
  esFinanciacionProveedor: boolean;
}

export interface CatalogosPrestamos {
  bancos: CatalogoItemDto[];
  lineas: CatalogoItemDto[];
}

export interface PrestamoFiltros {
  moneda?: Moneda;
  bancoId?: number;
  lineaCreditoId?: number;
  incluirCancelados?: boolean;
}

export interface VencimientoFiltros {
  moneda: Moneda;
  desde?: string;
  hasta?: string;
  bancoId?: number;
  lineaCreditoId?: number;
  incluirPagadas?: boolean;
}

/** Cuota tal como se manda a guardar (sin `total`: lo calcula el backend). */
export interface CuotaInput {
  nroCuota: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  iva: number;
  observacion?: string | null;
}

export interface PrestamoInput {
  bancoId: number;
  sucursal: string | null;
  lineaCreditoId: number;
  nroOperacion: string | null;
  moneda: Moneda;
  tipo: TipoPrestamo;
  capitalOriginal: number | null;
  fechaOtorgamiento: string | null;
  /** Total del préstamo original. Se declara cuando faltan las cuotas ya pagadas. */
  cantidadCuotas: number | null;
  periodicidad: Periodicidad;
  tasaNominalAnual: number | null;
  observaciones: string | null;
  cuotas: CuotaInput[];
}

/** Entrada del asistente de cronograma. */
export interface CronogramaInput {
  capital: number;
  cantidadCuotas: number;
  periodicidad: Periodicidad;
  primerVencimiento: string;
}

/** Cuota propuesta por el asistente (todavía sin persistir). */
export interface CuotaPropuesta {
  nroCuota: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  iva: number;
}

export interface PagarCuotaInput {
  cuotaId: number;
  fechaPago: string;
  importePagado?: number | null;
  observacion?: string | null;
}

/** Qué hizo (o qué haría) una importación de la plantilla. */
export interface ImportacionPrestamos {
  operacionesCreadas: number;
  operacionesActualizadas: number;
  cuotasCargadas: number;
  /** False = fue una vista previa; nada se guardó. */
  confirmado: boolean;
  advertencias: string[];
}

// ── Conciliación con MacroGest ──────────────────────────────────────────────

/** Una operación del sistema, en la vista de conciliación. */
export interface FilaConciliacion {
  prestamoId: number;
  nroOperacion: string | null;
  banco: string;
  linea: string;
  capital: number;
}

/** Un préstamo que el banco registró y el sistema no tiene, con lo que se pudo parsear del texto. */
export interface FilaPropuesta {
  nroOperacion: string;
  banco: string;
  capitalUsd: number | null;
  tasaNominalAnual: number | null;
  concepto: string;
  fecha: string;
}

/**
 * El cruce contra MacroGest. Es el control que el Excel nunca tuvo: en la primera corrida
 * encontró préstamos cargados sin respaldo bancario y préstamos del banco sin cargar.
 */
export interface ConciliacionMacroGest {
  desde: string;
  conciliadas: FilaConciliacion[];
  sinRespaldoBancario: FilaConciliacion[];
  sinCargar: FilaPropuesta[];
  sinNumeroDeOperacion: FilaConciliacion[];
  hayDiferencias: boolean;
}

// ── Resumen banco × período ─────────────────────────────────────────────────

/** `mes` = una columna por mes (planificar caja); `fecha` = una por vencimiento (ver el detalle). */
export type Agrupacion = "mes" | "fecha";

export interface ResumenFiltros extends VencimientoFiltros {
  agrupacion?: Agrupacion;
}

/** Un banco y lo que le vence en cada período. `montos` está alineado índice a índice con `periodos`. */
export interface FilaResumen {
  banco: string;
  montos: number[];
  total: number;
}

/**
 * La matriz banco × período: el reemplazo de la tabla dinámica del Excel. La diferencia es que
 * sale del mismo dato que el calendario, así que no puede quedar desactualizada respecto de él.
 */
export interface ResumenPrestamos {
  moneda: Moneda;
  /** Claves ordenables: `yyyy-MM` o `yyyy-MM-dd` según la agrupación. */
  periodos: string[];
  filas: FilaResumen[];
  totalesPorPeriodo: number[];
  totalGeneral: number;
}

// ── Conciliación de pagos con MacroGest ─────────────────────────────────────

/** Un débito del banco que se propone imputar a una cuota pendiente. */
export interface PagoSugerido {
  prestamoId: number;
  cuotaId: number;
  nroOperacion: string | null;
  banco: string;
  linea: string;
  moneda: Moneda;
  nroCuota: number;
  cantidadCuotas: number;
  fechaVencimiento: string;
  totalCuota: number;
  /** Fecha del débito: es la que queda como fecha de pago si se confirma. */
  fechaPago: string;
  /** Lo que debitó el banco, en pesos: capital + intereses + impuestos. */
  importeDebitado: number;
  concepto: string;
  importeCoincide: boolean;
  /** `null` en dólares: el banco debita pesos al cambio del día y comparar no significa nada. */
  diferenciaArs: number | null;
}

/** Un débito que no se pudo proponer. */
export interface PagoNoImputado {
  nroComprobante: string;
  fecha: string;
  importeArs: number;
  banco: string;
  concepto: string;
  prestamoId: number | null;
  nroOperacion: string | null;
}

/**
 * El cruce de los pagos del banco contra las cuotas pendientes. Todo es una **propuesta**: nada
 * queda marcado como pagado hasta que alguien lo confirma.
 */
export interface ConciliacionPagos {
  desde: string;
  sugeridos: PagoSugerido[];
  sinCuotaPendiente: PagoNoImputado[];
  sinPrestamo: PagoNoImputado[];
  hayPropuestas: boolean;
}

export interface ConfirmarPagoItem {
  cuotaId: number;
  fechaPago: string;
  importePagado?: number | null;
}
