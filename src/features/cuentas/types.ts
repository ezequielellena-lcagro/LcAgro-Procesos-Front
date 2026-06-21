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
  vendedor?: string;
  minUsd?: number;
  page: number;
  pageSize: number;
}

/** Payload del upsert de observación por cuenta. */
export interface ObservacionInput {
  cuenta: number;
  devolucion: string | null;
  observaciones: string | null;
}
