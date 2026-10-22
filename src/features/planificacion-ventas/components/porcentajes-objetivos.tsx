import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toAppError } from "@/lib/api-error";
import type { BaseObjetivosResponse, IndicadorObjetivo, TipoObjetivo } from "../types";
import { useGuardarPorcentajesObjetivos } from "../queries/use-base-objetivos";
import {
  cambiosPorcentajes,
  entradaPorcentaje,
  erroresPorcentajes,
  INDICADORES_OBJETIVO,
  type BorradorPorcentajes,
  type EntradaPorcentaje,
} from "../lib/porcentajes-objetivos";

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Los porcentajes de objetivos que fija gestión para la campaña siguiente a la base. Se editan en
 * el lugar y se guardan juntos; cada indicador lleva su revisión, así dos personas no se pisan.
 * El panel lo monta con `key` por campaña: otra campaña arranca con el borrador vacío.
 */
export function PorcentajesObjetivos({
  data,
  onRecargar,
  onDirtyChange,
}: {
  data: BaseObjetivosResponse;
  /** Relee la base: tras un 409 trae lo que guardó la otra persona, con sus revisiones. */
  onRecargar: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [borrador, setBorrador] = useState<BorradorPorcentajes>({});
  const [conflicto, setConflicto] = useState(false);
  const guardar = useGuardarPorcentajesObjetivos();
  const cambios = useMemo(() => cambiosPorcentajes(data.porcentajes, borrador), [data.porcentajes, borrador]);
  const errores = useMemo(() => erroresPorcentajes(borrador), [borrador]);
  const hayErrores = Object.keys(errores).length > 0;
  const editable = data.porcentajesEditables && !guardar.isPending;
  const dirty = cambios.length > 0;

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  function editar(indicador: IndicadorObjetivo, cambio: Partial<EntradaPorcentaje>) {
    setBorrador((previo) => ({
      ...previo,
      [indicador]: { ...entradaPorcentaje(data.porcentajes, previo, indicador), ...cambio },
    }));
  }

  async function guardarCambios() {
    if (!dirty || hayErrores) return;
    try {
      await guardar.mutateAsync({ campania: data.campaniaObjetivo, request: { indicadores: cambios } });
      setBorrador({});
      setConflicto(false);
      toast.success("Porcentajes guardados.");
    } catch (error) {
      const respuesta = toAppError(error);
      if (respuesta.status === 409) {
        // El borrador se conserva para que lo vea; guardar queda bloqueado hasta descartarlo, así no
        // sale con las revisiones nuevas pisando lo que cargó la otra persona.
        setConflicto(true);
        onRecargar();
      }
      toast.error(respuesta.message);
    }
  }

  return (
    <section className="rounded-card border border-line bg-panel shadow-card" aria-label="Porcentajes de objetivos">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Porcentajes de objetivos {data.campaniaObjetivo}
          </h2>
          <p className="text-sm text-ink-soft">
            Los carga gestión. El objetivo de cada vendedor sale de aplicarlos sobre lo real {data.campania}.
          </p>
        </div>
        {data.porcentajesEditables && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-ink-soft" aria-live="polite">
              {dirty ? `${cambios.length} sin guardar` : "Sin cambios pendientes"}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBorrador({});
                setConflicto(false);
              }}
              disabled={!dirty || guardar.isPending}
            >
              Descartar
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={() => void guardarCambios()}
              disabled={!dirty || hayErrores || guardar.isPending || conflicto}
            >
              {guardar.isPending ? "Guardando…" : "Guardar porcentajes"}
            </Button>
          </div>
        )}
      </div>
      {!data.porcentajesEditables && (
        <p className="border-b border-line bg-panel-soft px-5 py-3 text-sm text-ink-soft">
          Los objetivos {data.campaniaObjetivo} ya no se pueden cambiar.
        </p>
      )}
      {conflicto && (
        <p role="alert" className="border-b border-line bg-red-50 px-5 py-3 text-sm text-rojo">
          Otra persona cambió estos porcentajes. Descartá tus cambios para ver lo que guardó y volvé a cargar los tuyos.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">Indicador</th>
              <th scope="col" className="px-4 py-3 text-left">Cómo se aplica</th>
              <th scope="col" className="px-4 py-3 text-right">Porcentaje</th>
              <th scope="col" className="px-4 py-3 text-left">Última modificación</th>
            </tr>
          </thead>
          <tbody>
            {INDICADORES_OBJETIVO.map(({ id, nombre, admiteNivel }) => {
              const entrada = entradaPorcentaje(data.porcentajes, borrador, id);
              const guardado = data.porcentajes.find((item) => item.indicador === id);
              const error = errores[id];
              return (
                <tr key={id} className="border-t border-line">
                  <th scope="row" className="px-4 py-2 text-left font-semibold text-ink">{nombre}</th>
                  <td className="px-4 py-2">
                    {admiteNivel ? (
                      <Select
                        aria-label={`Cómo se aplica ${nombre}`}
                        value={entrada.tipo}
                        onChange={(evento) => editar(id, { tipo: evento.target.value as TipoObjetivo })}
                        disabled={!editable}
                        className="h-9 w-40"
                      >
                        <option value="crecimiento">Crecer</option>
                        <option value="nivel">Llegar a</option>
                      </Select>
                    ) : (
                      <span className="text-ink-soft">Crecer</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="ml-auto flex w-32 items-center gap-2">
                      <Input
                        aria-label={`Porcentaje de ${nombre}`}
                        aria-invalid={error ? true : undefined}
                        inputMode="decimal"
                        value={entrada.texto}
                        onChange={(evento) => editar(id, { texto: evento.target.value })}
                        disabled={!editable}
                        placeholder="—"
                        className="h-9 text-right tabular"
                      />
                      <span className="text-ink-soft">%</span>
                    </div>
                    {error && <p className="mt-1 text-xs text-rojo">{error}</p>}
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-soft">
                    {guardado?.modificadoPor && guardado.modificadoEl
                      ? `${guardado.modificadoPor} · ${fechaHora(guardado.modificadoEl)}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
