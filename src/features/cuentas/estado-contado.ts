import type { EstadoContado } from "./types";

export type Semaforo = "rojo" | "amarillo" | "verde";

/**
 * Presentación por estado de contado: etiqueta legible, color del semáforo (rojo/amarillo/verde)
 * y clases del badge (pill). No hay token "ámbar" propio en la paleta: el amarillo de "a vencer"
 * usa `clementina` (el mismo naranja de advertencia que ya usa el badge de vencimiento de stock).
 */
export const ESTADO_CONTADO_META: Record<
  EstadoContado,
  { label: string; semaforo: Semaforo; badgeCls: string }
> = {
  Mora: { label: "En mora", semaforo: "rojo", badgeCls: "bg-rojo-bg text-rojo" },
  AVencer: { label: "A vencer", semaforo: "amarillo", badgeCls: "bg-clementina/15 text-clementina-deep" },
  AlDia: { label: "Al día", semaforo: "verde", badgeCls: "bg-verde-bg text-verde" },
  PagoTarde: { label: "Pagó tarde", semaforo: "amarillo", badgeCls: "bg-clementina/15 text-clementina-deep" },
  PagadaEnPlazo: { label: "Pagada en plazo", semaforo: "verde", badgeCls: "bg-verde-bg text-verde" },
  SaldadaPorCanje: { label: "Saldada por canje", semaforo: "verde", badgeCls: "bg-panel-soft text-ink-soft" },
};

/** Clases del punto del semáforo según su color. */
export const SEMAFORO_DOT: Record<Semaforo, string> = {
  rojo: "bg-rojo",
  amarillo: "bg-clementina-deep",
  verde: "bg-verde",
};

/** Orden de importancia (mayor = peor / más urgente). Espeja el enum numérico del backend. */
export const ORDEN_CONTADO: Record<EstadoContado, number> = {
  SaldadaPorCanje: 1,
  PagadaEnPlazo: 2,
  PagoTarde: 3,
  AlDia: 4,
  AVencer: 5,
  Mora: 6,
};
