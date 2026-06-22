/** Formato de cada columna para los exportadores (Excel y PDF comparten la misma definición). */
export type ExportFormat = "text" | "number" | "usd" | "percent";

export interface ExportColumn<T> {
  header: string;
  /** Valor crudo de la celda (número o texto). El exportador se encarga del formato. */
  get: (row: T) => string | number | null;
  format?: ExportFormat; // por defecto "text"
  total?: boolean; // si la columna se suma en la fila de totales
}

export interface ExportSpec<T> {
  filename: string; // sin extensión
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
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
