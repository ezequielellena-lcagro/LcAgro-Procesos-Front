import { calcularTotales, esNumerica, type ExportColumn, type ExportSpec } from "./export-types";

// Formatos de número de Excel (se muestran con los separadores locales del Excel del usuario).
const NUM_FMT: Record<Exclude<ExportColumn<unknown>["format"], "text" | undefined>, string> = {
  number: "#,##0.00",
  usd: '"US$" #,##0.00',
  percent: '#,##0.00"%"',
};

const CLEMENTINA = "#FFC10E"; // header
const SLATE = "#21303A"; // texto del header
const TOTAL_BG = "#EEF1F3"; // fila de totales
const BORDER = "#D8DEE3";

/** Exporta a un .xlsx real con header de color, números formateados y fila de totales. */
export async function exportToXlsx<T>(spec: ExportSpec<T>): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const { columns, rows } = spec;

  const header = columns.map((c) => ({
    value: c.header,
    fontWeight: "bold" as const,
    backgroundColor: CLEMENTINA,
    color: SLATE,
    align: (esNumerica(c) ? "right" : "left") as "left" | "right",
    borderColor: BORDER,
    borderStyle: "thin" as const,
  }));

  const cuerpo = rows.map((r) =>
    columns.map((c) => {
      const v = c.get(r);
      if (esNumerica(c)) {
        return v == null
          ? { value: undefined, align: "right" as const }
          : { type: Number, value: Number(v), format: NUM_FMT[c.format as "number"], align: "right" as const };
      }
      return { value: v == null ? undefined : String(v), align: "left" as const };
    }),
  );

  const totales = calcularTotales(columns, rows);
  const filaTotales =
    totales.size === 0
      ? []
      : [
          columns.map((c, i) => {
            if (i === 0) return { value: "TOTAL", fontWeight: "bold" as const, backgroundColor: TOTAL_BG };
            if (totales.has(i))
              return {
                type: Number,
                value: totales.get(i)!,
                format: NUM_FMT[(c.format ?? "number") as "number"],
                align: "right" as const,
                fontWeight: "bold" as const,
                backgroundColor: TOTAL_BG,
              };
            return { value: undefined, backgroundColor: TOTAL_BG };
          }),
        ];

  const data = [header, ...cuerpo, ...filaTotales];

  await writeXlsxFile(data, {
    columns: columns.map((c) => ({ width: Math.max(12, c.header.length + 4) })),
    sheet: spec.title.slice(0, 28),
    stickyRowsCount: 1,
  }).toFile(`${spec.filename}.xlsx`);
}
