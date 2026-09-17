import { Button } from "@/components/ui/button";

export function BarraGuardado({
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
  if (cantidad === 0) return null;
  return (
    <div className="sticky bottom-3 z-30 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-ink px-4 py-3 text-panel shadow-xl">
      <span className="text-sm font-semibold">
        {cantidad} {cantidad === 1 ? "productor modificado" : "productores modificados"}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onDescartar}
          disabled={guardando}
          className="text-panel hover:text-ink"
        >
          Descartar
        </Button>
        <Button type="button" onClick={onGuardar} disabled={hayErrores || guardando}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
