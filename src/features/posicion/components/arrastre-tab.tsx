import { Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useConfig, useGuardarConfig } from "@/features/config/queries/use-config";
import { ErrorState } from "@/shared/components/error-state";
import { numero } from "@/shared/format/format";
import { desdeConfig, haciaConfig } from "../campania-format";
import { useArrastresIniciales, useGuardarArrastre, type ArrastreOp } from "../queries/use-arrastres";
import { CEREALES } from "../types";
import { ArrastreForm } from "./arrastre-form";

const CLAVE_INICIO = "campania_minima";

export function ArrastreTab({ puedeGestionar, puedeConfig, campanias }: {
  puedeGestionar: boolean;
  puedeConfig: boolean;
  campanias: string[];
}) {
  const arrastres = useArrastresIniciales();
  const config = useConfig();
  const guardar = useGuardarArrastre();

  const inicioRaw = config.data?.find((c) => c.clave === CLAVE_INICIO)?.valor;
  const campaniaInicio = desdeConfig(inicioRaw);

  const [editing, setEditing] = useState<string | "new" | null>(null);

  // Filas de la grilla: la campaña de inicio (siempre, aunque no tenga arrastre) + las que tienen arrastre.
  const filas = useMemo(() => {
    const set = new Set<string>();
    if (campaniaInicio) set.add(campaniaInicio);
    for (const a of arrastres.data ?? []) set.add(a.campania);
    return [...set].sort();
  }, [arrastres.data, campaniaInicio]);

  const existentesDe = (campania: string) => arrastres.data?.filter((a) => a.campania === campania) ?? [];
  const celda = (campania: string, cereal: string) =>
    arrastres.data?.find((a) => a.campania === campania && a.cereal === cereal);

  const campaniasNuevas = campanias.filter((c) => !filas.includes(c));

  const onSubmit = async (campania: string, ops: ArrastreOp[]) => {
    if (ops.length > 0) await guardar.mutateAsync({ campania, ops });
    setEditing(null);
  };

  const editandoCamp = editing && editing !== "new" ? editing : null;

  return (
    <div className="space-y-4">
      <CampaniaInicioBox inicioRaw={inicioRaw} puedeConfig={puedeConfig} />

      <div className="rounded-card border border-line bg-panel p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-ink">Arrastre por campaña</h3>
            <p className="text-sm text-ink-soft">
              La primera fila (inicio) es la semilla. Agregá una fila solo para pisar el arrastre de un año; el resto
              se calcula solo.
            </p>
          </div>
          {puedeGestionar && (
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={() => setEditing("new")}
              disabled={campaniasNuevas.length === 0}
            >
              <Plus className="size-4" /> Agregar arrastre
            </Button>
          )}
        </div>

        {arrastres.isError ? (
          <ErrorState error={arrastres.error} onRetry={() => void arrastres.refetch()} />
        ) : arrastres.isPending || config.isPending ? (
          <p className="py-6 text-center text-sm text-ink-soft">Cargando arrastre…</p>
        ) : filas.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">
            No hay arrastre cargado. Configurá la campaña de inicio y cargá el arrastre inicial por cereal.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pr-3 font-semibold">Campaña</th>
                  {CEREALES.map((c) => (
                    <th key={c} className="py-2 pr-3 text-right font-semibold">
                      {c}
                    </th>
                  ))}
                  {puedeGestionar && <th className="py-2" />}
                </tr>
              </thead>
              <tbody>
                {filas.map((camp) => (
                  <tr key={camp} className="border-b border-line-soft last:border-0">
                    <td className="py-2 pr-3 font-medium text-ink">
                      {camp}
                      {camp === campaniaInicio && (
                        <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs font-normal text-ink-soft">
                          inicio
                        </span>
                      )}
                    </td>
                    {CEREALES.map((cer) => {
                      const a = celda(camp, cer);
                      return (
                        <td key={cer} className="tabular py-2 pr-3 text-right text-ink">
                          {a ? `${a.signo}${numero(a.tn)}` : <span className="text-ink-soft">—</span>}
                        </td>
                      );
                    })}
                    {puedeGestionar && (
                      <td className="py-2 pl-2 text-right">
                        <Button type="button" variant="ghost" size="icon" aria-label={`Editar arrastre ${camp}`} onClick={() => setEditing(camp)}>
                          <Pencil className="size-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editandoCamp ? `Arrastre · ${editandoCamp}` : "Nuevo arrastre"}
        >
          <ArrastreForm
            campaniaFija={editandoCamp}
            campaniasDisponibles={campaniasNuevas}
            existentes={editandoCamp ? existentesDe(editandoCamp) : []}
            submitting={guardar.isPending}
            onSubmit={onSubmit}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function CampaniaInicioBox({ inicioRaw, puedeConfig }: { inicioRaw: string | undefined; puedeConfig: boolean }) {
  const guardarConfig = useGuardarConfig();
  const [valor, setValor] = useState(desdeConfig(inicioRaw) ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setValor(desdeConfig(inicioRaw) ?? ""), [inicioRaw]);

  const onGuardar = () => {
    const cfg = haciaConfig(valor);
    if (!cfg) {
      setError("Campaña inválida (ej. 2023-2024).");
      return;
    }
    setError(null);
    guardarConfig.mutate([{ clave: CLAVE_INICIO, valor: cfg }]);
  };

  const inicio = desdeConfig(inicioRaw);

  return (
    <div className="rounded-card border border-line bg-panel p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-display text-base font-semibold text-ink">Campaña de inicio</h3>
          <p className="text-sm text-ink-soft">
            El panel muestra la posición desde esta campaña y encadena el arrastre hacia adelante.
          </p>
        </div>
        {puedeConfig ? (
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="campania-inicio">Campaña</Label>
              <Input
                id="campania-inicio"
                className="w-36"
                placeholder="2023-2024"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <Button type="button" size="sm" onClick={onGuardar} disabled={guardarConfig.isPending}>
              {guardarConfig.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        ) : (
          <p className="text-sm">
            <span className="text-ink-soft">Actual: </span>
            <b className="text-ink">{inicio ?? "—"}</b>
          </p>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-rojo">{error}</p>}
    </div>
  );
}
