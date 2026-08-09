// Formateadores de presentación en cultura es-AR. Espejan a LcAgro.Shared.Formatting del backend.
const tnFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const usdFmt = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

export const usd = (n: number) => `US$ ${usdFmt.format(n)}`;
/** Pesos. Mismo formato que `usd`: en las pantallas que mezclan monedas el símbolo es lo único que cambia. */
export const ars = (n: number) => `$ ${usdFmt.format(n)}`;
export const tn = (n: number) => `${tnFmt.format(n)} tn`;
export const pct = (n: number) => `${pctFmt.format(n)} %`;
export const numero = (n: number) => tnFmt.format(n);
export const fecha = (iso: string) => {
  // Una fecha "sola" (YYYY-MM-DD) se parsea como LOCAL para no correrla un día por timezone
  // (new Date("2026-07-05") sería UTC medianoche → un día antes en husos negativos). Los datetime
  // con hora/zona siguen el parseo normal.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return d.toLocaleDateString("es-AR");
};

/** Aplica el formateador, o devuelve "—" si el valor es null/undefined. */
export function oDash<T>(value: T | null | undefined, fmt: (v: T) => string): string {
  return value == null ? "—" : fmt(value);
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Nombre largo de un mes (1–12) con su año, ej. `mesAnio(2026, 7)` → "Julio 2026". */
export const mesAnio = (anio: number, mes: number) => `${MESES[mes - 1] ?? mes} ${anio}`;
