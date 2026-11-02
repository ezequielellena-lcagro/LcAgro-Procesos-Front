/**
 * Estados de Cargas a puerto, con el vocabulario de la planilla de logística (las doce hojas
 * mensuales del Drive, relevadas el 2026-10-29). Los del ciclo van en orden: MacroGest puede
 * adelantar el estado, nunca atrasarlo. El backend valida contra la misma lista.
 */
export const CICLO_CARGA = [
  "DISPONIBLE",
  "AUTORIZADO",
  "LLAMADO",
  "CARGANDO",
  "EN VIAJE",
  "CALADO",
  "DESCARGADO",
] as const;

/** Desvíos y cupos que no se concretaron: MacroGest no los pisa. */
export const EXCEPCIONES_CARGA = [
  "RECHAZADO",
  "DESVIADO",
  "ACONDICIONADORA",
  "NO LO USÓ",
  "PERDIDO POR HORARIO",
  "NO SE CONSIGUIÓ CAMIÓN",
  "DADO DE BAJA",
  "PENDIENTE PASAR CUPO",
] as const;

export const ESTADOS_CARGA: readonly string[] = [...CICLO_CARGA, ...EXCEPCIONES_CARGA];

/** Color del estado en la grilla: verde lo terminado, rojo lo que no salió. */
export function tonoEstado(estado: string): string {
  if (estado === "DESCARGADO") return "text-verde font-medium";
  if ((EXCEPCIONES_CARGA as readonly string[]).includes(estado)) return "text-rojo font-medium";
  if (estado === "EN VIAJE" || estado === "CALADO") return "text-ink font-medium";
  return "text-ink-soft";
}
