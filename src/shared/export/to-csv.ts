export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/**
 * Exporta filas a CSV y dispara la descarga. Separador ";" y BOM UTF-8 para que Excel (es-AR)
 * respete acentos y columnas. (Un .xlsx real es una mejora futura: librería lazy-loaded.)
 */
export function exportToCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const head = columns.map((c) => esc(c.header)).join(";");
  const body = rows.map((r) => columns.map((c) => esc(c.value(r))).join(";")).join("\n");
  const bom = "﻿"; // Excel respeta UTF-8 (acentos) si el archivo empieza con BOM.
  const content = bom + head + "\n" + body;

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
