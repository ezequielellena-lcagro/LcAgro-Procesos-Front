import type { EnvaseSemillero } from "./types";

const unidadesFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const kgFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const tFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const fechaHoraFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Argentina/Buenos_Aires",
});

export const unidades = (n: number) => unidadesFmt.format(n);
export const kg = (n: number) => `${kgFmt.format(n)} kg`;
export const toneladas = (kilos: number) => `${tFmt.format(kilos / 1000)} t`;
/** Los instantes llegan en UTC; la gente del semillero los ve en hora argentina. */
export const fechaHora = (iso: string) => fechaHoraFmt.format(new Date(iso));

export function envaseCantidad(envase: EnvaseSemillero, cantidad: number): string {
  if (envase === "BigBag") return `${unidades(cantidad)} BB`;
  return `${unidades(cantidad)} ${cantidad === 1 ? "bolsa" : "bolsas"}`;
}
