import { numero, pct, usd } from "@/shared/format/format";
import { calcularTotales, esNumerica, type ExportColumn, type ExportSpec } from "./export-types";

function comoTexto<T>(col: ExportColumn<T>, v: string | number | null): string {
  if (v == null) return "—";
  switch (col.format) {
    case "number":
      return numero(Number(v));
    case "usd":
      return usd(Number(v));
    case "percent":
      return pct(Number(v));
    default:
      return String(v);
  }
}

/** Exporta a un PDF generado como documento (título + tabla con header de color + totales). */
export async function exportToPdf<T>(spec: ExportSpec<T>): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const { columns, rows } = spec;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(33, 48, 58);
  doc.text(spec.title, margin, 42);

  if (spec.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 130, 138);
    doc.text(spec.subtitle, margin, 60);
  }

  const head = [columns.map((c) => c.header)];
  const body = rows.map((r) => columns.map((c) => comoTexto(c, c.get(r))));

  const totales = calcularTotales(columns, rows);
  const foot =
    totales.size === 0
      ? undefined
      : [columns.map((c, i) => (i === 0 ? "TOTAL" : totales.has(i) ? comoTexto(c, totales.get(i)!) : ""))];

  // Alineación por columna (numéricas a la derecha) para head, body y foot.
  const columnStyles: Record<number, { halign: "left" | "right" }> = {};
  columns.forEach((c, i) => {
    columnStyles[i] = { halign: esNumerica(c) ? "right" : "left" };
  });

  autoTable(doc, {
    head,
    body,
    foot,
    startY: spec.subtitle ? 76 : 58,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 4, lineColor: [216, 222, 227], textColor: [33, 48, 58] },
    headStyles: { fillColor: [43, 65, 80], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [238, 241, 243], textColor: [33, 48, 58], fontStyle: "bold" },
    columnStyles,
  });

  doc.save(`${spec.filename}.pdf`);
}
