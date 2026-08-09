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

/**
 * Deuda financiera con bancos. Pesos y dólares no se suman: son dos calendarios distintos y
 * convertirlos exigiría un tipo de cambio que nadie pidió.
 */
export interface PrestamosKpis {
  saldoUsd: number;
  saldoArs: number;
  operacionesVigentes: number;
  proximoVencimiento: string | null;
  cuotasVencidas: number;
}

export interface DashboardDto {
  posicion: PosicionKpis;
  cuentas: CuentasKpis;
  prestamos: PrestamosKpis;
}
