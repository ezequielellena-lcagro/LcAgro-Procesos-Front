import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toAppError } from "@/lib/api-error";
import { cn } from "@/lib/utils";

interface Props {
  /** Por qué no se pudo traer el stock para la orden; `null` mientras se espera. */
  error: Error | null;
  onReintentar: () => void;
  onCancelar: () => void;
}

/**
 * Lo que se ve entre el clic en "Nueva orden"/"Editar"/"Orden" y la apertura del diálogo, que
 * espera el stock completo recién pedido (R1.2). Sin este aviso el clic parecería no hacer nada; y
 * si el pedido falla, se puede reintentar o desistir sin perder la página. Va fijo abajo: se ve
 * aunque la tabla esté desplazada, no corre el contenido y queda debajo de cualquier diálogo.
 * Escape desiste, igual que cerraría el diálogo.
 */
export function PedidoOrdenAviso({ error, onReintentar, onCancelar }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancelar]);

  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "no-print fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl flex-wrap items-center gap-2",
        "rounded-card border px-3 py-2 text-sm shadow-float",
        error ? "border-rojo/30 bg-rojo-bg text-rojo" : "border-line bg-panel-soft text-ink-soft",
      )}
    >
      <p className="flex-1">
        {error
          ? `No se pudo traer el stock para armar la orden: ${toAppError(error).message}`
          : "Preparando la orden…"}
      </p>
      {error && (
        <Button type="button" size="sm" variant="outline" onClick={onReintentar}>
          Reintentar
        </Button>
      )}
      <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
        Cancelar
      </Button>
    </div>
  );
}
