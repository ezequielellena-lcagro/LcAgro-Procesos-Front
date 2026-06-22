import type { jsPDF as JsPdf } from "jspdf";
import { numero, pct, usd } from "@/shared/format/format";
import { calcularTotales, esNumerica, type ExportColumn, type ExportKpi, type ExportSpec } from "./export-types";

// Dibuja las tarjetas de KPI (como en pantalla) en filas. Devuelve la Y debajo de las tarjetas.
function drawKpiCards(doc: JsPdf, kpis: ExportKpi[], startY: number, margin: number, pageWidth: number): number {
  const usable = pageWidth - margin * 2;
  const perRow = Math.min(kpis.length, 4);
  const gap = 10;
  const cardW = (usable - gap * (perRow - 1)) / perRow;
  const maxMetricas = Math.max(...kpis.map((k) => k.metricas.length));
  const cardH = 34 + maxMetricas * 12 + 6;

  kpis.forEach((k, i) => {
    const x = margin + (i % perRow) * (cardW + gap);
    const y = startY + Math.floor(i / perRow) * (cardH + gap);

    doc.setDrawColor(216, 222, 227);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardW, cardH, 4, 4, "FD");

    const ac: [number, number, number] = k.acento === "rojo" ? [190, 30, 45] : [21, 128, 61];
    doc.setFillColor(ac[0], ac[1], ac[2]);
    doc.rect(x, y, 3, cardH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(33, 48, 58);
    doc.text(k.titulo, x + 10, y + 18);

    let my = y + 34;
    for (const m of k.metricas) {
      doc.setFontSize(m.destacado ? 10 : 8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 130, 138);
      doc.text(m.label, x + 10, my);
      doc.setFont("helvetica", m.destacado ? "bold" : "normal");
      doc.setTextColor(33, 48, 58);
      doc.text(m.valor, x + cardW - 10, my, { align: "right" });
      my += 12;
    }
  });

  return startY + Math.ceil(kpis.length / perRow) * (cardH + gap);
}

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

  let tableStartY = spec.subtitle ? 72 : 54;
  if (spec.kpis?.length) {
    tableStartY = drawKpiCards(doc, spec.kpis, tableStartY, margin, doc.internal.pageSize.getWidth()) + 4;
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
    startY: tableStartY,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 4, lineColor: [216, 222, 227], textColor: [33, 48, 58] },
    headStyles: { fillColor: [43, 65, 80], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [238, 241, 243], textColor: [33, 48, 58], fontStyle: "bold" },
    columnStyles,
  });

  doc.save(`${spec.filename}.pdf`);
}
