import { numero, numero3, pct, usd } from "@/shared/format/format";
import type { ExportFormat } from "@/shared/export/export-types";

/** Texto de una celda numérica en pantalla. Null es "sin dato" y se muestra como raya. */
export function mostrarCelda(valor: string | number | null, formato?: ExportFormat): string {
  if (valor === null) return "—";
  if (formato === "usd") return usd(Number(valor));
  if (formato === "percent") return pct(Number(valor));
  if (formato === "number3") return numero3(Number(valor));
  if (formato === "number") return numero(Number(valor));
  return String(valor);
}

export const alineacionCelda = (formato?: ExportFormat) =>
  formato && formato !== "text" ? "text-right" : "text-left";
