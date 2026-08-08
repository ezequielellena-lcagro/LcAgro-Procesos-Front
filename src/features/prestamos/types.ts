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
