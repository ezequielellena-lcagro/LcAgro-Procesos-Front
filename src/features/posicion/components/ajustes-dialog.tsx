import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ErrorState } from "@/shared/components/error-state";
import { numero } from "@/shared/format/format";
import { useAjustes } from "../queries/use-ajustes";
import { useCrearAjuste, useEditarAjuste, useEliminarAjuste } from "../queries/use-ajuste-mutations";
import type { AjusteDto, AjusteInput } from "../types";
import { AjusteForm } from "./ajuste-form";

export function AjustesDialog({
  open,
  onClose,
  campania,
}: {
  open: boolean;
  onClose: () => void;
  campania: string;
}) {
  const { data: ajustes, isPending, isError, error, refetch } = useAjustes(campania, open);
  const crear = useCrearAjuste(campania);
  const editar = useEditarAjuste(campania);
  const eliminar = useEliminarAjuste(campania);

  const [editing, setEditing] = useState<AjusteDto | "new" | null>(null);

  const onSubmit = async (input: AjusteInput) => {
    if (editing === "new") await crear.mutateAsync(input);
    else if (editing) await editar.mutateAsync({ id: editing.id, input });
    setEditing(null);
  };

  const onEliminar = (a: AjusteDto) => {
    if (window.confirm(`¿Dar de baja el ajuste de ${a.cereal} (${a.signo}${numero(a.tn)} tn)?`)) {
      eliminar.mutate(a.id);
    }
  };

  const cerrar = () => {
    setEditing(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={cerrar} title={`Ajustes · ${campania}`}>
      {editing ? (
        <AjusteForm
          campania={campania}
          edit={editing === "new" ? null : editing}
          submitting={crear.isPending || editar.isPending}
          onSubmit={onSubmit}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-ink-soft">Arrastre, semilla, canje y producción propia de la campaña.</p>
            <Button type="button" variant="accent" size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Nuevo ajuste
            </Button>
          </div>

          {isPending ? (
            <p className="py-6 text-center text-sm text-ink-soft">Cargando ajustes…</p>
          ) : isError ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : ajustes && ajustes.length > 0 ? (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pr-2 font-semibold">Cereal</th>
                  <th className="py-2 pr-2 font-semibold">Tipo</th>
                  <th className="py-2 pr-2 text-right font-semibold">Tn firmadas</th>
                  <th className="py-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {ajustes.map((a) => (
                  <tr key={a.id} className="border-b border-line-soft last:border-0">
                    <td className="py-2 pr-2 font-medium text-ink">{a.cereal}</td>
                    <td className="py-2 pr-2 text-ink-soft">{a.tipo.replace("_", " ")}</td>
                    <td className="py-2 pr-2 text-right tabular text-ink">
                      {a.signo}
                      {numero(a.tn)}
                    </td>
                    <td className="py-2 pl-2">
                      <div className="flex justify-end gap-1">
                        <Button type="button" variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(a)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Dar de baja"
                          onClick={() => onEliminar(a)}
                          disabled={eliminar.isPending}
                        >
                          <Trash2 className="size-4 text-rojo" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm text-ink-soft">Esta campaña no tiene ajustes cargados.</p>
          )}
        </>
      )}
    </Modal>
  );
}
