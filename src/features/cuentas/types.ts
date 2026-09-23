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
  /**
   * Día al que se miran los saldos (yyyy-MM-dd). Sin valor = hoy, que es el uso normal de la pantalla.
   * Con una fecha pasada, el listado vuelve a dar lo que daba ese día: sirve para reproducir un informe
   * ya presentado cuando los números de MacroGest siguieron moviéndose.
   */
  corte?: string;
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
  /** Día al que están los saldos devueltos (yyyy-MM-dd): hoy, o el corte que se pidió. */
  corte: string;
}

/** Payload del upsert de observación por cuenta. */
export interface ObservacionInput {
  cuenta: number;
  devolucion: string | null;
  observaciones: string | null;
}

// ── Contado (facturas de contado impagas: vencidas y a vencer) ────────────────────
// El backend ya descarta las vencidas de cuentas sin saldo vencido.
// Espeja ContadoDto del backend. Todas las fechas vienen como yyyy-MM-dd.

/** Filtros de la solapa (los mismos de la FilterBar de la pantalla). */
export interface ContadoFiltros {
  vendNro?: number;
  minUsd?: number;
  /** Mismo corte que el listado. Ojo: retroactivo es aproximado (ver `corte` en la respuesta). */
  corte?: string;
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
 * conciliación: pueden ser menores que `monto`, e incluso <= 0, porque los pagos por canje LPG/LSG bajan
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
 * Estado del cierre: el período ABIERTO y si su mes ya terminó. `faltaCerrar` es SOLO un aviso: nada
 * se cierra ni se blanquea hasta que alguien aprieta "Cerrar mes". Espeja GET /cuentas/cierre/estado.
 */
export interface CierreEstado {
  anio: number;
  mes: number;
  /** El mes del período abierto ya terminó y nadie lo cerró todavía → conviene cerrarlo. */
  faltaCerrar: boolean;
}

/** Un período ya CERRADO (una fila del selector de meses). Espeja un item de /cuentas/cierre/periodos.
 * Los totales y el corte son los de la revisión VIGENTE. */
export interface CierrePeriodo {
  anio: number;
  mes: number;
  cuentas: number;
  saldo: number;
  /** Día al que quedaron congelados los saldos (yyyy-MM-dd); lo eligió quien cerró. */
  corte: string;
  /** Cuándo se apretó "Cerrar mes" (ISO datetime UTC); puede ser bastante posterior al corte. */
  fechaCierre: string;
  /** Revisión vigente (la más alta). */
  revision: number;
  /** Cuántas revisiones tiene el período. > 1 = se re-fotografió alguna vez. */
  revisiones: number;
}

/** Una revisión de la foto de un período (selector de revisiones). */
export interface CierreRevision {
  revision: number;
  corte: string;
  fechaCierre: string;
  cuentas: number;
  saldo: number;
  vigente: boolean;
}

/** Qué le pasó a una cuenta entre la foto guardada y lo que MacroGest devuelve hoy. */
export type TipoCambioCierre = "Cambiada" | "Agregada" | "Quitada";

/** Una cuenta del diff: la foto contra MacroGest hoy, al MISMO corte. */
export interface CierreDiffCuenta {
  cuenta: number;
  denominacion: string;
  vendedor: string | null;
  tipo: TipoCambioCierre;
  vencidoFoto: number;
  vencidoActual: number;
  saldoFoto: number;
  saldoActual: number;
  /** Actual − foto. Positivo = hoy debe más de lo que decía el informe. */
  delta: number;
}

/**
 * Resultado de contrastar la foto de un período contra MacroGest al mismo corte. Sin cambios, el
 * informe presentado sigue siendo exacto; con cambios, son registraciones con fecha retroactiva
 * (alguien cargó un comprobante fechado dentro del período después de que se cerró).
 * Espeja GET /cuentas/cierre/{anio}/{mes}/diff.
 */
export interface CierreDiff {
  anio: number;
  mes: number;
  revision: number;
  corte: string;
  hayCambios: boolean;
  cambiadas: number;
  agregadas: number;
  quitadas: number;
  deltaSaldo: number;
  items: CierreDiffCuenta[];
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
 * Foto completa de un período cerrado. `anio`/`mes` es el mes que el informe REPRESENTA y `corte` la
 * fecha a la que quedaron los saldos, que eligió quien cerró: cerrar septiembre con corte 07-10 es lo
 * normal, porque ese es el día en que se presentó el informe. Solo entran movimientos con
 * fecha_contable <= corte, así la foto no cambia aunque MacroGest siga moviéndose.
 * Espeja GET /cuentas/cierre/{anio}/{mes}. Orden de `items`: vendedor, luego cuenta.
 */
export interface CierreDetalle {
  anio: number;
  mes: number;
  corte: string;
  totales: TotalesCierre;
  items: CierreCuenta[];
  /** Revisión que se está mostrando. */
  revision: number;
  /** Cuándo se guardó esta revisión (ISO datetime UTC). */
  fechaCierre: string;
}

/** Respuesta de POST /cuentas/cierre (y del re-cierre): el mes cerrado, su corte y sus totales. */
export interface CierreResultado {
  anio: number;
  mes: number;
  cuentas: number;
  saldo: number;
  corte: string;
  revision: number;
}
