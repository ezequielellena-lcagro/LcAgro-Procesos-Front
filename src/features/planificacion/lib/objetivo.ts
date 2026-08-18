/**
 * Objetivo sugerido y validaciones de la carga.
 *
 * La fórmula NO se inventa acá: es la que ya está documentada en el backend
 * (`appsettings.json` → `VolumenAcopiado`):
 *
 *   "Objetivo sugerido = base + (1 − penetración) × FactorDormidos:
 *    más exigencia a quien tiene cartera para reactivar."
 *
 * Se aplica sobre el cierre de la campaña anterior. Cuando exista el endpoint, estos dos
 * parámetros llegan desde la config del servidor, no hardcodeados en el front.
 */
import type { AvisoObjetivo, LineaObjetivo, Vendedor } from "../types";

/** `VolumenAcopiado:CrecimientoBase` — hoy 15 %. */
export const CRECIMIENTO_BASE = 0.15;
/** `VolumenAcopiado:FactorDormidos` — hoy 15 %. */
export const FACTOR_DORMIDOS = 0.15;

/** Cierre de la campaña anterior para la línea pedida. */
export const previoDe = (v: Vendedor, linea: LineaObjetivo) =>
  linea === "insumos" ? v.previoInsumos : v.previoGranos;

/** Objetivo acordado hoy para la línea pedida. */
export const objetivoDe = (v: Vendedor, linea: LineaObjetivo) =>
  linea === "insumos" ? v.objetivoInsumos : v.objetivoGranos;

export const realDe = (v: Vendedor, linea: LineaObjetivo) =>
  linea === "insumos" ? v.realInsumos : v.realGranos;

export const estadoDe = (v: Vendedor, linea: LineaObjetivo) =>
  linea === "insumos" ? v.estadoInsumos : v.estadoGranos;

export const notaDe = (v: Vendedor, linea: LineaObjetivo) =>
  linea === "insumos" ? v.notaInsumos : v.notaGranos;

/** Lo que propone el sistema. `base` es ajustable desde la pantalla para la charla con Dirección. */
export function objetivoSugerido(v: Vendedor, linea: LineaObjetivo, base = CRECIMIENTO_BASE): number {
  return previoDe(v, linea) * (1 + base + (1 - v.penetracion) * FACTOR_DORMIDOS);
}

/**
 * Avisos sobre un objetivo cargado. Es la diferencia concreta contra el Excel:
 * un objetivo por debajo del año anterior hoy pasa desapercibido.
 */
export function validarObjetivo(
  v: Vendedor,
  linea: LineaObjetivo,
  base = CRECIMIENTO_BASE,
): AvisoObjetivo | null {
  const valor = objetivoDe(v, linea);
  const previo = previoDe(v, linea);
  const sugerido = objetivoSugerido(v, linea, base);

  if (!(valor > 0)) return { nivel: "error", texto: "Falta definir el objetivo." };
  if (valor < previo) return { nivel: "error", texto: "Queda por debajo del cierre de la campaña anterior." };
  if (valor > sugerido * 1.3)
    return { nivel: "warn", texto: "Más de 30 % por encima del sugerido — revisar que sea alcanzable." };
  if (valor < previo * 1.02)
    return { nivel: "warn", texto: "Prácticamente sin crecimiento respecto de la campaña anterior." };
  return null;
}

/**
 * Semáforo del avance. Se compara contra el RITMO ESPERADO a la fecha, no contra el 100 %:
 * en agosto nadie lleva el 100 % de la campaña, y pintar todo de rojo no informa nada.
 */
export function tonoAvance(avance: number, esperado: number): "ok" | "medio" | "malo" {
  if (esperado <= 0) return "ok";
  const relativo = avance / esperado;
  if (relativo >= 1) return "ok";
  if (relativo >= 0.8) return "medio";
  return "malo";
}
