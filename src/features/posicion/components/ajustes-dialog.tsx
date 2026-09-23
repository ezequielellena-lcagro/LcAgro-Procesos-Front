import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/shared/components/error-state";
import { numero } from "@/shared/format/format";
import { useAjustes } from "../queries/use-ajustes";
import { useCrearAjuste, useEditarAjuste, useEliminarAjuste } from "../queries/use-ajuste-mutations";
import type { AjusteDto, AjusteInput } from "../types";
import { AjusteForm } from "./ajuste-form";
import { ArrastrePanel } from "./arrastre-panel";

type TabAjustes = "ajustes" | "arrastre";

/**
 * Configuración de la posición, en un solo lugar: los ajustes manuales de LA campaña elegida
 * (pestaña "Ajustes") y el arrastre inicial de TODAS las campañas (pestaña "Arrastre"). El arrastre
 * era una pestaña del panel; se mudó acá porque es configuración, no una vista de la posición.
 */
export function AjustesDialog({
  open,
  onClose,
  campania,
  campanias,
  puedeGestionar,
  puedeConfig,
}: {
  open: boolean;
  onClose: () => void;
  campania: string;
  campanias: string[];
  puedeGestionar: boolean;
  puedeConfig: boolean;
}) {
  const { data: ajustes, isPending, isError, error, refetch } = useAjustes(campania, open);
  const crear = useCrearAjuste(campania);
  const editar = useEditarAjuste(campania);
  const eliminar = useEliminarAjuste(campania);

  const [tab, setTab] = useState<TabAjustes>("ajustes");
  const [editing, setEditing] = useState<AjusteDto | "new" | null>(null);

  // El arrastre (calculado) y el arrastre_inicial (semilla/override) NO se editan acá: van en la pestaña Arrastre.
  const manuales = ajustes?.filter((a) => a.tipo !== "arrastre" && a.tipo !== "arrastre_inicial");

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
    setTab("ajustes");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title={`Ajustes · ${campania}`}
      // La grilla del arrastre lleva un cereal por columna: en el ancho por defecto no entra.
      className={tab === "arrastre" ? "max-w-4xl" : undefined}
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
          <TabsTrigger value="arrastre">Arrastre</TabsTrigger>
        </TabsList>

        <TabsContent value="ajustes">
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
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">Semilla, canje y producción propia de la campaña {campania}.</p>
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  className="flex-none"
                  onClick={() => setEditing("new")}
                >
                  <Plus className="size-4" /> Nuevo ajuste
                </Button>
              </div>

              {isPending ? (
                <p className="py-6 text-center text-sm text-ink-soft">Cargando ajustes…</p>
              ) : isError ? (
                <ErrorState error={error} onRetry={refetch} />
              ) : manuales && manuales.length > 0 ? (
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
                    {manuales.map((a) => (
                      <tr key={a.id} className="border-b border-line-soft last:border-0">
                        <td className="py-2 pr-2 font-medium text-ink">{a.cereal}</td>
                        <td className="py-2 pr-2 text-ink-soft">{a.tipo.replace("_", " ")}</td>
                        <td className="py-2 pr-2 text-right tabular text-ink">
                          {a.signo}
                          {numero(a.tn)}
                        </td>
                        <td className="py-2 pl-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Editar"
                              onClick={() => setEditing(a)}
                            >
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
        </TabsContent>

        <TabsContent value="arrastre">
          <ArrastrePanel puedeGestionar={puedeGestionar} puedeConfig={puedeConfig} campanias={campanias} />
        </TabsContent>
      </Tabs>
    </Modal>
  );
}
