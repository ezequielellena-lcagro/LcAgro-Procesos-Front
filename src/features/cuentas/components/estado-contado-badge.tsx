import { cn } from "@/lib/utils";
import { ESTADO_CONTADO_META, SEMAFORO_DOT } from "../estado-contado";
import type { EstadoContado } from "../types";

/** Pill con la etiqueta del estado. Se usa en el detalle de facturas de contado. */
export function EstadoContadoBadge({ estado }: { estado: EstadoContado }) {
  const { label, badgeCls } = ESTADO_CONTADO_META[estado];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", badgeCls)}>{label}</span>
  );
}

/**
 * Punto de semáforo (rojo/amarillo/verde) para la columna del listado. El texto va oculto para
 * lectores de pantalla; el color es la señal visual. Compacto para no ensanchar la fila.
 */
export function EstadoContadoSemaforo({ estado }: { estado: EstadoContado }) {
  const { label, semaforo } = ESTADO_CONTADO_META[estado];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-full", SEMAFORO_DOT[semaforo])} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
