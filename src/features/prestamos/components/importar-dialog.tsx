import { useState } from "react";
import { AlertTriangle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toAppError } from "@/lib/api-error";
import { useImportarPlantilla } from "../queries/use-prestamos-excel";
import type { ImportacionPrestamos } from "../types";

/**
 * Importa la plantilla en dos tiempos: primero una **vista previa** (el backend valida el archivo
 * entero y devuelve qué haría, sin escribir nada) y recién con la confirmación se aplica.
 *
 * El paso extra existe porque la importación es todo o nada sobre datos financieros: ver "13
 * operaciones nuevas" cuando esperabas 2 es la última oportunidad de frenar.
 */
export function ImportarDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importar = useImportarPlantilla();
  const [file, setFile] = useState<File | null>(null);
  const [previa, setPrevia] = useState<ImportacionPrestamos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    setFile(null);
    setPrevia(null);
    setError(null);
    onClose();
  };

  const elegir = async (elegido: File | null) => {
    setFile(elegido);
    setPrevia(null);
    setError(null);
    if (!elegido) return;

    try {
      setPrevia(await importar.mutateAsync({ file: elegido, confirmar: false }));
    } catch (err) {
      setError(toAppError(err).message);
    }
  };

  const confirmar = async () => {
    if (!file) return;
    try {
      await importar.mutateAsync({ file, confirmar: true });
      cerrar();
    } catch (err) {
      setError(toAppError(err).message);
    }
  };

  return (
    <Modal open={open} onClose={cerrar} title="Importar plantilla" className="max-w-lg">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          Subí la plantilla de préstamos (hojas <strong>Operaciones</strong> y{" "}
          <strong>Cuotas</strong>). Descargala con <em>Exportar plantilla</em>, editala y volvé a
          subirla: las operaciones con Id se actualizan y las que tienen una referencia nueva se
          crean.
        </p>

        <label className="flex cursor-pointer items-center gap-3 rounded-card border border-dashed border-line bg-panel-soft p-4 hover:border-primary">
          <FileSpreadsheet className="size-6 shrink-0 text-ink-soft" />
          <span className="text-sm">
            {file ? <strong>{file.name}</strong> : "Elegí un archivo .xlsx"}
          </span>
          <input
            type="file"
            accept=".xlsx"
            className="sr-only"
            onChange={(e) => void elegir(e.target.files?.[0] ?? null)}
          />
        </label>

        {importar.isPending && <p className="text-sm text-ink-soft">Revisando el archivo…</p>}

        {error && (
          <div className="rounded-card border border-rojo/30 bg-rojo-bg p-3 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-rojo">
              <AlertTriangle className="size-4" /> No se importó nada
            </p>
            <p className="mt-1 text-ink">{error}</p>
          </div>
        )}

        {previa && !error && (
          <div className="rounded-card border border-line bg-panel-soft p-3 text-sm">
            <p className="font-medium">Si confirmás, se va a guardar:</p>
            <ul className="mt-1 list-inside list-disc text-ink-soft">
              <li>
                <strong>{previa.operacionesCreadas}</strong> operación(es) nueva(s)
              </li>
              <li>
                <strong>{previa.operacionesActualizadas}</strong> actualizada(s)
              </li>
              <li>
                <strong>{previa.cuotasCargadas}</strong> cuota(s)
              </li>
            </ul>
            <p className="mt-2 text-xs text-ink-soft">Las cuotas ya pagadas no se modifican.</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={cerrar} disabled={importar.isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={confirmar}
            disabled={!previa || !!error || importar.isPending}
          >
            {importar.isPending ? "Importando…" : "Confirmar importación"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
