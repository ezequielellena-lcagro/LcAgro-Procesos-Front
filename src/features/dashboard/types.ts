/** KPIs cruzados Posición + Cuentas (espeja DashboardDto del backend). */
export interface PosicionKpis {
  campania: string | null;
  tnCompra: number;
  tnVenta: number;
  tnCalzadas: number;
  resultadoUsd: number;
  posicionFinalTn: number;
  cereales: number;
}

export interface CuentasKpis {
  totalCuentas: number;
  saldoTotalUsd: number;
  saldoVencidoUsd: number;
  saldoAVencerUsd: number;
  cuentasConVencido: number;
}

export interface DashboardDto {
  posicion: PosicionKpis;
  cuentas: CuentasKpis;
}
