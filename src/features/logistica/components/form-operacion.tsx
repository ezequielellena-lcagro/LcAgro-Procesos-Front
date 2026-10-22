import { confirmacionPendiente } from "../lib/comandos";
import { RotateCcw, Save } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { toAppError } from "@/lib/api-error";
/**
 * Rótulo + control de los formularios de Logística.
 *
 * Va con `flex`/`gap` y no con `space-y-*`: el rótulo es texto suelto dentro del label, y
 * `space-y` sólo separa hijos ELEMENTO, así que el gap quedaba en cero y el control se pegaba al
 * rótulo. En una fila compartida con un `CatalogoSelect` —que sí separa 6 px— los controles
 * arrancaban a distinta altura. El 1.5 es el mismo aire que usa el resto de la app.
 */
export function Campo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-soft">
      {titulo}
      {children}
    </label>
  );
}
export function FormOperacionFooter({
  error,
  invalid,
  pending,
  onClose,
  texto = "Guardar",
  confirmacionIncierta = false,
}: {
  error: unknown;
  invalid?: boolean;
  pending: boolean;
  onClose: () => void;
  texto?: string;
  confirmacionIncierta?: boolean;
}) {
  const incierto = confirmacionIncierta || confirmacionPendiente(error);
  const detalle = error != null ? toAppError(error) : null;
  return (
    <div className="mt-5 space-y-3 border-t border-line pt-4">
      {detalle && (
        <p role="alert" className="text-sm text-rojo">
          {detalle.message}
          {incierto && " Reintentá sin cambiar los datos para confirmar el resultado."}
          {detalle.status === 409 && " Cerrá y volvé a abrir el registro actualizado."}
        </p>
      )}
      {/* El identificador de la traza es lo único que permite encontrar la falla en el log del
          servidor. Sin esto, un error en la planta sólo se podía reportar como "no anda". */}
      {detalle?.traceId && (
        <p className="text-xs text-ink-soft">
          Para reportarlo: error {detalle.status} · traza <code>{detalle.traceId}</code>
        </p>
      )}
      {invalid && (
        <p role="alert" className="text-sm text-rojo">
          Completá los campos obligatorios con valores válidos.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={pending || incierto} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {incierto ? (
            <RotateCcw className="size-4" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}{" "}
          {pending ? "Guardando…" : incierto ? "Reintentar operación" : texto}
        </Button>
      </div>
    </div>
  );
}
