import { Button } from "@/components/ui/button";

/**
 * Acciones de guardado del plan, al final de la barra de filtros.
 *
 * Siempre visibles mientras la campaña sea editable: así el botón está donde se lo busca y su
 * estado (habilitado o no) dice si queda algo por guardar, sin que aparezca una barra flotante.
 */
export function AccionesGuardado({
  cantidad,
  hayErrores,
  guardando,
  onDescartar,
  onGuardar,
}: {
  cantidad: number;
  hayErrores: boolean;
  guardando: boolean;
  onDescartar: () => void;
  onGuardar: () => void;
}) {
  const sinCambios = cantidad === 0;
  return (
    <div className="ml-auto flex items-center gap-3">
      <span className="text-xs font-semibold text-ink-soft" aria-live="polite">
        {sinCambios
          ? "Sin cambios pendientes"
          : cantidad + (cantidad === 1 ? " productor modificado" : " productores modificados")}
      </span>
      <Button
        type="button"
        variant="outline"
        onClick={onDescartar}
        disabled={sinCambios || guardando}
      >
        Descartar
      </Button>
      <Button
        type="button"
        variant="accent"
        onClick={onGuardar}
        disabled={sinCambios || hayErrores || guardando}
      >
        {guardando ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}
