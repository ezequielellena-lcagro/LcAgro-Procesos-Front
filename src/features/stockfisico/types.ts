// Espejan los DTOs de StockCereal del backend (LcAgro.Application.StockCereal.Dtos).

/** Semáforo de vencimiento de fijación (enum EstadoFijacion; serializa como string). */
export type EstadoFijacion = "SinFecha" | "Vencido" | "Naranja" | "Amarillo" | "Verde";

/** Una fila del consolidado por cereal, en toneladas. */
export interface ConsolidadoCerealDto {
  cereal: string;
  p15: number;
  p20: number;
  p10: number;
  silobolsa: number;
  total: number;
}

/** KPIs del encabezado: totales por componente + riesgo de fijación. */
export interface TotalesCereal {
  p15: number;
  p20: number;
  p10: number;
  silobolsa: number;
  total: number;
  vencidoTn: number;
  vencidoContratos: number;
  proximo30Tn: number;
  proximo30Contratos: number;
}

/** Una línea del detalle de planta 10 (a fijar por contrato). */
export interface AFijarDetalleDto {
  comprador: string;
  cereal: string;
  contrato: string;
  campania: string;
  aFijarTn: number;
  vtoFijacion: string | null;
  diasParaVto: number | null;
  estado: EstadoFijacion;
  directo: boolean;
}

/** Una línea de la alerta "descarga sin pasar". */
export interface AlertaDescargaDto {
  contrato: string;
  comprador: string;
  cereal: string;
  campania: string;
  fijadoTn: number;
}

/** Reporte completo de stock físico de cereal. */
export interface StockCerealDto {
  fecha: string;
  consolidado: ConsolidadoCerealDto[];
  detallePlanta10: AFijarDetalleDto[];
  alertasDescarga: AlertaDescargaDto[];
  totales: TotalesCereal;
  silobolsaPendiente: boolean;
}
