import { fecha } from "../format";
import type { FlotaSeguimientoDto } from "../types";
import { referenciaFlota } from "./flota";

// Las filas, la revisión humana y el historial comparten el mismo formato exacto.
export function columnasCamion() {
  return [
    { titulo: "Chasis", celda: (f: FlotaSeguimientoDto) => f.patenteChasis },
    { titulo: "Acoplado", celda: (f: FlotaSeguimientoDto) => f.patenteAcoplado ?? "Sin dato" },
    { titulo: "Conductor", celda: (f: FlotaSeguimientoDto) => f.conductor ?? "Sin dato" },
    { titulo: "Transportista", celda: (f: FlotaSeguimientoDto) => f.transportista ?? "Sin dato" },
    {
      titulo: "Importe de referencia",
      numero: true,
      celda: (f: FlotaSeguimientoDto) => referenciaFlota(f.importeReferencia, null),
    },
    { titulo: "Moneda", celda: (f: FlotaSeguimientoDto) => f.moneda ?? "Sin dato" },
    {
      titulo: "Vigente desde",
      celda: (f: FlotaSeguimientoDto) =>
        f.vigenteDesde == null ? "Sin dato" : fecha(f.vigenteDesde),
    },
    { titulo: "Revisión de la ficha", celda: (f: FlotaSeguimientoDto) => String(f.revision) },
    { titulo: "Versión elegida", celda: (f: FlotaSeguimientoDto) => f.versionId },
  ];
}
