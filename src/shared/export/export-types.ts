/** Formato de cada columna para los exportadores (Excel y PDF comparten la misma definición). */
export type ExportFormat = "text" | "number" | "usd" | "percent";

export interface ExportColumn<T> {
  header: string;
  /** Valor crudo de la celda (número o texto). El exportador se encarga del formato. */
  get: (row: T) => string | number | null;
  format?: ExportFormat; // por defecto "text"
  total?: boolean; // si la columna se suma en la fila de totales
}

/** Una métrica dentro de una tarjeta de KPI (label + valor ya formateado). */
export interface ExportKpiMetric {
  label: string;
  valor: string;
  destacado?: boolean; // se resalta (grande/negrita) en la tarjeta del PDF
}

/** Tarjeta de KPI (p. ej. un cereal): título + métricas. Espeja las tarjetas de la pantalla. */
export interface ExportKpi {
  titulo: string;
  acento?: "verde" | "rojo"; // color del borde/acento (p. ej. signo de la posición)
  metricas: ExportKpiMetric[];
}

export interface ExportSpec<T> {
  filename: string; // sin extensión
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  /** KPIs (tarjetas) que se muestran arriba de la tabla de detalle. */
  kpis?: ExportKpi[];
  kpisTitulo?: string; // por defecto "Resumen por cereal"
}

/** Indica si la columna es numérica (alineada a la derecha en ambos exportadores). */
export const esNumerica = <T>(c: ExportColumn<T>) => c.format != null && c.format !== "text";

/** Suma de las columnas marcadas con `total`. Devuelve un mapa índice-de-columna → suma. */
export function calcularTotales<T>(columns: ExportColumn<T>[], rows: T[]): Map<number, number> {
  const totales = new Map<number, number>();
  columns.forEach((col, i) => {
    if (!col.total) return;
    let suma = 0;
    for (const r of rows) {
      const v = col.get(r);
      if (typeof v === "number") suma += v;
    }
    totales.set(i, suma);
  });
  return totales;
}
