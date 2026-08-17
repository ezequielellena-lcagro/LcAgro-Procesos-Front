import type { EstadoCliente } from "../types";

/** Historia (campaña → tn) a serie ordenada cronológicamente. Las claves "AAAA-AAAA" ordenan por texto. */
export function historiaValores(historia: Record<string, number>): number[] {
  return Object.keys(historia)
    .sort()
    .map((k) => historia[k]);
}

/** Color del sparkline según el estado del cliente (mismo criterio que el badge). */
export function sparkToneDeEstado(estado: EstadoCliente): "verde" | "rojo" | "clementina" {
  return estado === "Creciente" ? "verde" : estado === "Dormido" ? "rojo" : "clementina";
}
