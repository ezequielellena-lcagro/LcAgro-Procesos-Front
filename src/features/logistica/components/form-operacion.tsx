import { confirmacionPendiente } from "../lib/comandos";
import { RotateCcw, Save } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { toAppError } from "@/lib/api-error";
export function Campo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-xs font-medium text-ink-soft">
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
  return (
    <div className="mt-5 space-y-3 border-t border-line pt-4">
      {error != null && (
        <p role="alert" className="text-sm text-rojo">
          {toAppError(error).message}
          {incierto && " Reintentá sin cambiar los datos para confirmar el resultado."}
          {toAppError(error).status === 409 && " Cerrá y volvé a abrir el registro actualizado."}
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
