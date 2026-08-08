import type { Moneda } from "./types";

const importeFmt = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Importe sin símbolo, con 2 decimales SIEMPRE.
 *
 * No se usa `usd()` del shared porque acá conviven pesos y dólares en pantallas separadas: el
 * símbolo lo pone el encabezado de la vista, no cada celda. Y los 2 decimales son fijos a
 * propósito: en una columna de plata, "2.601.402,3" al lado de "31.350,00" no alinea ni se lee.
 */
export function importe(n: number): string {
  return importeFmt.format(n);
}

/** Símbolo de la moneda, para los encabezados y los totales. */
export function monedaLabel(m: Moneda): string {
  return m === "USD" ? "U$S" : "$";
}

/** Importe con su símbolo, para los KPIs y los textos sueltos. */
export function importeConMoneda(n: number, m: Moneda): string {
  return `${monedaLabel(m)} ${importe(n)}`;
}
