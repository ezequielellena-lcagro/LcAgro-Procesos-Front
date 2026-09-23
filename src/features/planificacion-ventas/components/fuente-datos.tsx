import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * Hasta cuándo están frescos los datos de MacroGest y el botón para traerlos de nuevo. El criterio
 * de cálculo (ver `lib/leyendas.ts`) va sólo en el PDF, no acá.
 *
 * Se dibuja en el encabezado de la página —arriba a la derecha, a la altura del título— a través
 * de `slot`: el nodo lo expone la página y cada solapa manda ahí su fuente por portal, así la
 * lógica de refresco (que en Plan de siembra confirma el borrador antes de recargar) sigue
 * viviendo en su panel. Sin `slot` se dibuja en el lugar donde se lo monta.
 */
export function FuenteDatos({
  datosMacroGestAl,
  onActualizar,
  actualizando,
  slot,
}: {
  datosMacroGestAl: string | null;
  onActualizar: () => void;
  actualizando: boolean;
  slot?: HTMLElement | null;
}) {
  const hora = datosMacroGestAl
    ? new Date(datosMacroGestAl).toLocaleTimeString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const contenido = (
    <div className="no-print flex items-center gap-2 text-xs text-ink-soft">
      <span>{hora ? `Datos de MacroGest al ${hora}` : "Sin datos de MacroGest"}</span>
      <Button type="button" variant="outline" size="sm" onClick={onActualizar} disabled={actualizando}>
        Actualizar
      </Button>
    </div>
  );
  return slot ? createPortal(contenido, slot) : contenido;
}
