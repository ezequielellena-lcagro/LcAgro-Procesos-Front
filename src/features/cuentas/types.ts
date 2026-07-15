/**
 * Estado de cumplimiento de una factura "de contado" (espeja EstadoContado del backend).
 * A nivel cuenta solo aparecen los tres "abiertos" (Mora / AVencer / AlDia); los tres "cerrados"
 * (PagoTarde / PagadaEnPlazo / SaldadaPorCanje) solo se ven en el detalle de facturas.
 */
export type EstadoContado =
  | "SaldadaPorCanje"
  | "PagadaEnPlazo"
  | "PagoTarde"
  | "AlDia"
  | "AVencer"
  | "Mora";

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
  /** Peor estado de las facturas de contado abiertas de la cuenta (semáforo del listado). */
  estadoContado: EstadoContado;
}

/** Una factura de contado en el detalle de una cuenta (espeja FacturaContadoDto). */
export interface FacturaContado {
  comprobante: string; // ej. "A-38706"
  emision: string; // yyyy-MM-dd
  vencimiento: string; // yyyy-MM-dd
  plazoDias: number;
  importe: number;
  pendiente: number;
  fechaPago: string | null; // yyyy-MM-dd; null si abierta o saldada por canje
  estado: EstadoContado;
}

export interface CuentasFiltros {
  q?: string;
  vendNro?: number;
  minUsd?: number;
  /** Días para clasificar una factura como "a vencer" (amarillo) en vez de "al día" (verde). */
  umbralAvencer?: number;
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
