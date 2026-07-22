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

// ── Facturas en mora ────────────────────────────────────────────────────────────
// Espeja FacturasEnMoraDto del backend. Todas las fechas vienen como yyyy-MM-dd.

/** Filtros de la solapa (los mismos de la FilterBar de la pantalla). */
export interface FacturasMoraFiltros {
  vendNro?: number;
  minUsd?: number;
}

/** Una factura de contado vencida y sin cancelar. `pendiente` es lo que queda impago. */
export interface FacturaMora {
  comprobante: string;
  emision: string;
  vencimiento: string;
  plazoDias: number;
  diasAtraso: number;
  importe: number;
  pendiente: number;
}

/**
 * Cuenta con facturas en mora. `monto` es la suma de los `pendiente` de sus facturas; los tres
 * `saldo*` son el saldo GLOBAL de la cuenta (todos sus movimientos, no solo el contado) y son el
 * ancla de conciliación: pueden ser menores que `monto`, e incluso <= 0, porque los pagos por
 * canje/LSG bajan el saldo sin imputarse a la factura.
 */
export interface CuentaMora {
  cuenta: number;
  denominacion: string;
  saldoVencido: number;
  saldoAVencer: number;
  saldo: number;
  monto: number;
  facturas: FacturaMora[];
}

/** Vendedor con sus cuentas en mora. `cuentas`/`facturas` son contadores; `monto`, la suma. */
export interface VendedorMora {
  vendNro: number;
  vendedor: string;
  cuentas: number;
  facturas: number;
  monto: number;
  detalle: CuentaMora[];
}

/** Totales del set completo (no de un vendedor). */
export interface TotalesMora {
  vendedores: number;
  cuentas: number;
  facturas: number;
  monto: number;
}

/** Respuesta de GET /cuentas/facturas-en-mora. `corte` es la fecha contra la que se midió el atraso. */
export interface FacturasEnMora {
  corte: string;
  totales: TotalesMora;
  vendedores: VendedorMora[];
}
