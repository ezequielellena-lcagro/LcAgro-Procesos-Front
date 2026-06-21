// Formateadores de presentación en cultura es-AR. Espejan a LcAgro.Shared.Formatting del backend.
const tnFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const usdFmt = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

export const usd = (n: number) => `US$ ${usdFmt.format(n)}`;
export const tn = (n: number) => `${tnFmt.format(n)} tn`;
export const pct = (n: number) => `${pctFmt.format(n)} %`;
export const numero = (n: number) => tnFmt.format(n);
export const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR");

/** Aplica el formateador, o devuelve "—" si el valor es null/undefined. */
export function oDash<T>(value: T | null | undefined, fmt: (v: T) => string): string {
  return value == null ? "—" : fmt(value);
}
