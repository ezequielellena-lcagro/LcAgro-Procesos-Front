// Espejan los DTOs de ProduccionPropia del backend (LcAgro.Application.ProduccionPropia.Dtos).

/** Una fila por cereal con los tres planos: el saldo, cómo surge y dónde está. */
export interface FilaProduccionPropia {
  cereal: string;

  // Plano ②: cómo surge
  cosechado: number;
  vendido: number;
  precioUsd: number | null;
  /** Plano ①: cosechado − vendido (el número grande). */
  saldo: number;

  // Plano ③: dónde está. `ctaCte` null = no se cargó el saldo del reporte oficial ("s/d").
  ctaCte: number | null;
  embolsado: number;
  planta10: number;
  totalFisico: number;
  /** Físico − saldo comercial. NO es un error: es el control de que no falte mercadería. */
  difControl: number;
}

export interface TotalesProduccionPropia {
  cosechado: number;
  vendido: number;
  saldo: number;
  ctaCte: number;
  embolsado: number;
  planta10: number;
  totalFisico: number;
  difControl: number;
}

export interface ProduccionPropiaDto {
  campania: string;
  fecha: string;
  filas: FilaProduccionPropia[];
  totales: TotalesProduccionPropia;
  /** El cosechado sale de las planillas del share; true = no se pudo leer (va en 0). */
  cosechaPendiente: boolean;
  silobolsaPendiente: boolean;
}

/** Carga manual del saldo de cuenta corriente del productor 32. */
export interface SaldoCuentaRequest {
  campania: string;
  cereal: string;
  tn: number;
  fechaDato: string;
}
