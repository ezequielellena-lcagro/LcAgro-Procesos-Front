/** Fila de Cuentas Corrientes USD (espeja CuentaDto del backend). `denominacion` es PII. */
export interface CuentaDto {
  vendedor: string;
  vendNro: number;
  cuenta: number;
  denominacion: string;
  saldoVencido: number;
  saldoAVencer: number;
  saldo: number;
  devolucion: string | null;
  observaciones: string | null;
}

export interface CuentasFiltros {
  q?: string;
  vendNro?: number;
  minUsd?: number;
  page: number;
  pageSize: number;
}

/** Totales USD del set filtrado completo (no la página). Para los KPIs. */
export interface TotalesCuentas {
  vencido: number;
  aVencer: number;
  saldo: number;
  cuentas: number;
}

/** Subtotal USD de un vendedor sobre el set filtrado. */
export interface SubtotalVendedor {
  vendNro: number;
  vendedor: string;
  vencido: number;
  aVencer: number;
  saldo: number;
  cuentas: number;
}

/** Respuesta del listado (espeja CuentasListadoDto): la página + totales/subtotales del filtro completo. */
export interface CuentasListado {
  items: CuentaDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  totales: TotalesCuentas;
  subtotales: SubtotalVendedor[];
}

/** Payload del upsert de observación por cuenta. */
export interface ObservacionInput {
  cuenta: number;
  devolucion: string | null;
  observaciones: string | null;
}

// ── Contado (facturas de contado impagas: vencidas y a vencer) ────────────────────
// Espeja ContadoDto del backend. Todas las fechas vienen como yyyy-MM-dd.

/** Filtros de la solapa (los mismos de la FilterBar de la pantalla). */
export interface ContadoFiltros {
  vendNro?: number;
  minUsd?: number;
}

/**
 * Una factura de contado impaga. `vencida` distingue las ya vencidas de las que están a vencer;
 * `diasAtraso` son los días desde el vencimiento y solo tiene sentido cuando `vencida` (si no, 0).
 * `pendiente` es lo que queda impago.
 */
export interface FacturaContado {
  comprobante: string;
  emision: string;
  vencimiento: string;
  plazoDias: number;
  vencida: boolean;
  diasAtraso: number;
  importe: number;
  pendiente: number;
}

/**
 * Cuenta con facturas de contado impagas. `montoVencido`/`montoAVencer` suman el `pendiente` de las
 * facturas vencidas / a vencer, y `monto` es el total (contado impago de la cuenta). Los tres `saldo*`
 * son el saldo GLOBAL de la cuenta (todos sus movimientos, no solo el contado) y son el ancla de
 * conciliación: pueden ser menores que `monto`, e incluso <= 0, porque los pagos por canje/LSG bajan
 * el saldo sin imputarse a la factura.
 */
export interface CuentaContado {
  cuenta: number;
  denominacion: string;
  saldoVencido: number;
  saldoAVencer: number;
  saldo: number;
  montoVencido: number;
  montoAVencer: number;
  monto: number;
  facturas: FacturaContado[];
}

/** Vendedor con sus cuentas de contado. `cuentas`/`facturas` son contadores; los `monto*`, sumas. */
export interface VendedorContado {
  vendNro: number;
  vendedor: string;
  cuentas: number;
  facturas: number;
  montoVencido: number;
  montoAVencer: number;
  monto: number;
  detalle: CuentaContado[];
}

/** Totales del set completo (no de un vendedor). */
export interface TotalesContado {
  vendedores: number;
  cuentas: number;
  facturas: number;
  montoVencido: number;
  montoAVencer: number;
  monto: number;
}

/** Respuesta de GET /cuentas/contado. `corte` es la fecha contra la que se midió el vencimiento. */
export interface Contado {
  corte: string;
  totales: TotalesContado;
  vendedores: VendedorContado[];
}

// ── Histórico mensual (cierre) ──────────────────────────────────────────────────
// Foto por cuenta y por mes (append-only). Espeja el contrato de /cuentas/cierre.

/**
 * Estado del cierre: el período ABIERTO (mes en curso) y si ya terminó y falta cerrarlo.
 * Espeja GET /cuentas/cierre/estado.
 */
export interface CierreEstado {
  anio: number;
  mes: number;
  /** El período abierto ya terminó y nadie lo cerró todavía → conviene cerrar. */
  faltaCerrar: boolean;
}

/** Un período ya CERRADO (una fila del selector de meses). Espeja un item de /cuentas/cierre/periodos. */
export interface CierrePeriodo {
  anio: number;
  mes: number;
  cuentas: number;
  saldo: number;
  /** Cuándo se sacó la foto (ISO datetime UTC). */
  fechaCierre: string;
}

/** Totales USD congelados de la foto de un período. */
export interface TotalesCierre {
  cuentas: number;
  vencido: number;
  aVencer: number;
  saldo: number;
}

/** Una cuenta dentro de la foto de un período (solo lectura). `denominacion` es PII. */
export interface CierreCuenta {
  cuenta: number;
  denominacion: string;
  vendedor: string;
  vendNro: number;
  saldoVencido: number;
  saldoAVencer: number;
  saldo: number;
  devolucion: string | null;
  observaciones: string | null;
}

/**
 * Foto completa de un período cerrado. `corte` es el último día del mes: solo entran movimientos
 * con fecha_contable <= corte, así la foto es correcta aunque el cierre se corra tarde.
 * Espeja GET /cuentas/cierre/{anio}/{mes}. Orden de `items`: vendedor, luego cuenta.
 */
export interface CierreDetalle {
  anio: number;
  mes: number;
  corte: string;
  totales: TotalesCierre;
  items: CierreCuenta[];
}

/** Respuesta de POST /cuentas/cierre: el mes que quedó cerrado + sus totales. */
export interface CierreResultado {
  anio: number;
  mes: number;
  cuentas: number;
  saldo: number;
}
