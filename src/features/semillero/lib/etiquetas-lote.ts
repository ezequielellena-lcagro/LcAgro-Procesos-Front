import { ENVASES, type DuenioLote, type EnvaseSemillero } from "../types";

/**
 * "Propio" o "Cliente · {denominación}": el mismo texto en Stock, Movimientos y el armado de la
 * orden.
 */
export function duenioEtiqueta(f: {
  duenio: DuenioLote;
  clienteDenominacion: string | null;
}): string {
  return f.duenio === "Propio" ? "Propio" : `Cliente · ${f.clienteDenominacion}`;
}

export const tratamientoEtiqueta = (tratada: boolean) => (tratada ? "Tratada" : "Sin tratar");

export const envaseEtiqueta = (envase: EnvaseSemillero) =>
  ENVASES.find((e) => e.valor === envase)?.etiqueta ?? envase;

/**
 * "DM 46E25 · Tratada · BigBag": lo que distingue un producto de otro al armar una orden. Cargar
 * semilla tratada cuando la pidieron sin tratar es el error que esto busca evitar.
 */
export function productoEtiqueta(f: {
  variedad: string;
  tratada: boolean;
  envase: EnvaseSemillero;
}): string {
  return `${f.variedad} · ${tratamientoEtiqueta(f.tratada)} · ${envaseEtiqueta(f.envase)}`;
}

/** Recorta un texto largo para una sola línea, marcando el corte con "…". */
export function recortar(texto: string, maximo: number): string {
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo - 1).trimEnd()}…`;
}
