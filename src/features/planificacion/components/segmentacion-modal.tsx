import { ArrowRight, LoaderCircle, TriangleAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toAppError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { numero, pct } from "@/shared/format/format";
import {
  useGuardarMatrizSegmentacion,
  usePrevisualizarMatrizSegmentacion,
} from "../queries/use-segmentacion";
import { planificacionKeys } from "../queries/keys";
import type {
  CriterioMatrizSegmentacionDto,
  DistribucionSegmentacionDto,
  MatrizSegmentacionDto,
  MatrizSegmentacionRequest,
  Segmento,
} from "../types";

interface Props {
  matriz: MatrizSegmentacionDto;
  campania: string;
  onClose: () => void;
}

const SEGMENTOS: Segmento[] = ["A", "B", "C", "D"];

const TONO_SEGMENTO: Record<Segmento, string> = {
  A: "border-verde/25 bg-verde/10 text-verde",
  B: "border-clementina-deep/25 bg-clementina/15 text-clementina-deep",
  C: "border-slate-brand/20 bg-slate-brand/5 text-slate-brand",
  D: "border-line bg-panel-soft text-ink-soft",
};

function requestDesde(
  campania: string,
  revision: number,
  criterios: CriterioMatrizSegmentacionDto[],
): MatrizSegmentacionRequest {
  return {
    campania,
    revisionEsperada: revision,
    criterios: criterios.map((criterio) => ({
      criterio: criterio.criterio,
      peso: criterio.peso,
      // Los umbrales no se editan en este modal, pero forman parte del reemplazo completo.
      umbralAlto: criterio.umbralAlto,
      umbralMedio: criterio.umbralMedio,
      umbralMedioBajo: criterio.umbralMedioBajo,
      umbralBajo: criterio.umbralBajo,
    })),
  };
}

function firma(request: MatrizSegmentacionRequest): string {
  return JSON.stringify(request);
}

function pesoRepresentable(peso: number): boolean {
  return (
    Number.isFinite(peso) &&
    peso >= 0 &&
    peso <= 100 &&
    Math.abs(peso * 100 - Math.round(peso * 100)) < 1e-8
  );
}

/**
 * Configura cuánto pesa cada criterio y obliga a mirar el impacto antes de guardar.
 *
 * El preview queda ligado al request completo (revisión, pesos y umbrales). Si se cambia un peso,
 * deja de habilitar Guardar hasta calcular de nuevo; así nunca se confirma una distribución
 * distinta de la que la persona acaba de revisar.
 */
export function SegmentacionModal({ matriz, campania, onClose }: Props) {
  const [borrador, setBorrador] = useState<CriterioMatrizSegmentacionDto[]>(() =>
    matriz.criterios.map((criterio) => ({ ...criterio })),
  );
  const [firmaPrevisualizada, setFirmaPrevisualizada] = useState<string | null>(null);
  const preview = usePrevisualizarMatrizSegmentacion();
  const guardar = useGuardarMatrizSegmentacion();
  const queryClient = useQueryClient();

  const requestActual = requestDesde(campania, matriz.revision, borrador);
  const firmaActual = firma(requestActual);
  const pesoActivo = borrador.reduce((total, criterio) => total + Math.max(0, criterio.peso), 0);
  const pesosValidos = borrador.every((criterio) => pesoRepresentable(criterio.peso));
  const hayCambios = borrador.some(
    (criterio) =>
      criterio.peso !==
      matriz.criterios.find((original) => original.criterio === criterio.criterio)?.peso,
  );
  const previewVigente =
    preview.data !== undefined &&
    preview.data.revisionBase === matriz.revision &&
    firmaPrevisualizada === firmaActual;
  const procesando = preview.isPending || guardar.isPending;
  const error = preview.isError
    ? toAppError(preview.error)
    : guardar.isError
      ? toAppError(guardar.error)
      : null;

  function cambiarPeso(criterioId: CriterioMatrizSegmentacionDto["criterio"], peso: number) {
    preview.reset();
    setFirmaPrevisualizada(null);
    setBorrador((actual) =>
      actual.map((criterio) =>
        criterio.criterio === criterioId ? { ...criterio, peso } : criterio,
      ),
    );
  }

  async function cerrarPorConflicto(cause: unknown): Promise<boolean> {
    if (toAppError(cause).status !== 409) return false;
    // Antes de cerrar, se descarta la matriz cacheada para que al reabrir nunca reaparezca la
    // revisión que otro usuario acaba de reemplazar.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: planificacionKeys.matriz(campania) }),
      queryClient.invalidateQueries({
        queryKey: planificacionKeys.tablerosCampania(campania),
      }),
    ]);
    toast.error("La matriz cambió mientras la editabas. Se recargó la revisión vigente.");
    onClose();
    return true;
  }

  async function previsualizar() {
    if (!hayCambios || !pesosValidos || pesoActivo <= 0 || procesando) return;
    const request = requestActual;
    const firmaEnviada = firma(request);
    try {
      await preview.mutateAsync(request);
      setFirmaPrevisualizada(firmaEnviada);
    } catch (cause) {
      await cerrarPorConflicto(cause);
    }
  }

  async function confirmarGuardado() {
    if (!previewVigente || procesando) return;
    try {
      await guardar.mutateAsync(requestActual);
      onClose();
    } catch (cause) {
      await cerrarPorConflicto(cause);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Matriz de segmentación · ${campania}`}
      className="max-w-4xl"
    >
      <div className="space-y-5">
        <header className="rounded-card border border-line bg-panel-soft p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-ink">
                Ajustá los pesos; los umbrales vigentes se conservan sin cambios.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                El score se normaliza sobre los criterios activos. Un peso en <b>0</b> apaga el
                criterio sin borrar su configuración ni su historia.
              </p>
            </div>
            <div className="rounded-md border border-line bg-panel px-3 py-2 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                Peso activo
              </div>
              <div className="font-display text-xl font-semibold tabular text-ink">
                {numero(pesoActivo)}
              </div>
            </div>
          </div>
        </header>

        <fieldset disabled={procesando} className="space-y-2">
          <legend className="sr-only">Pesos de la matriz de segmentación</legend>
          {borrador.map((criterio) => {
            const apagado = criterio.peso === 0;
            const efectivo = pesoActivo > 0 ? (criterio.peso / pesoActivo) * 100 : 0;
            const descripcionId = `criterio-${criterio.criterio}-descripcion`;
            return (
              <div
                key={criterio.criterio}
                className={cn(
                  "grid gap-3 rounded-md border p-3 transition sm:grid-cols-[minmax(0,1fr)_9rem_10rem] sm:items-center",
                  apagado
                    ? "border-dashed border-line bg-panel opacity-65"
                    : "border-line bg-panel-soft",
                )}
              >
                <div className="min-w-0">
                  <label
                    htmlFor={`criterio-${criterio.criterio}-peso`}
                    className="text-sm font-semibold text-ink"
                  >
                    {criterio.nombre}
                  </label>
                  <p
                    id={descripcionId}
                    className="mt-0.5 text-[11px] leading-relaxed text-ink-soft"
                  >
                    {criterio.unidad} · umbrales ≥ {numero(criterio.umbralAlto)} / ≥{" "}
                    {numero(criterio.umbralMedio)} / ≥ {numero(criterio.umbralMedioBajo)} / ≥{" "}
                    {numero(criterio.umbralBajo)}
                  </p>
                  {criterio.aclaracion ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                      {criterio.aclaracion}
                    </p>
                  ) : null}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] text-ink-soft">
                    <span>Peso efectivo</span>
                    <span className="font-semibold tabular text-ink">
                      {apagado ? "Apagado" : pct(efectivo)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                    <div
                      className="h-full rounded-full bg-clementina-deep transition-[width]"
                      style={{ width: `${Math.min(100, Math.max(0, efectivo))}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  <input
                    id={`criterio-${criterio.criterio}-peso`}
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    inputMode="decimal"
                    value={criterio.peso}
                    onChange={(event) => cambiarPeso(criterio.criterio, Number(event.target.value))}
                    aria-describedby={descripcionId}
                    className="h-9 w-24 rounded-md border border-line bg-panel px-2 text-right text-sm font-semibold tabular text-ink outline-none focus:border-clementina-deep focus:ring-2 focus:ring-clementina/30"
                  />
                  <span className="w-12 text-xs text-ink-soft">puntos</span>
                </div>
              </div>
            );
          })}
        </fieldset>

        {!pesosValidos || pesoActivo <= 0 ? (
          <div
            role="alert"
            className="flex gap-2 rounded-md border border-rojo/30 bg-rojo/10 p-3 text-xs text-rojo"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              {!pesosValidos
                ? "Cada peso debe estar entre 0 y 100 y tener como máximo dos decimales."
                : "Subí al menos un peso: con todos los criterios apagados no hay score posible."}
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-rojo/30 bg-rojo/10 p-3 text-xs text-rojo"
          >
            <p className="font-semibold">No se pudo completar la operación.</p>
            <p className="mt-0.5">{error.message}</p>
          </div>
        ) : null}

        {preview.data ? (
          <section
            aria-live="polite"
            className={cn(
              "rounded-card border p-4",
              previewVigente
                ? "border-clementina-deep/35 bg-clementina/5"
                : "border-line bg-panel-soft opacity-70",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">
                  Impacto antes de guardar
                </h3>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {previewVigente
                    ? `Preview vigente sobre la revisión ${preview.data.revisionBase}.`
                    : "Este preview quedó desactualizado. Volvé a calcularlo antes de guardar."}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <ImpactoDato etiqueta="Cambian" valor={preview.data.impacto.cambian} destacado />
                <ImpactoDato etiqueta="Suben" valor={preview.data.impacto.suben} />
                <ImpactoDato etiqueta="Bajan" valor={preview.data.impacto.bajan} />
              </div>
            </div>

            <div className="mt-4 grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
              <Distribucion
                titulo="Distribución vigente"
                distribucion={preview.data.impacto.distribucionAntes}
              />
              <ArrowRight
                className="mx-auto size-5 rotate-90 text-clementina-deep md:rotate-0"
                aria-hidden
              />
              <Distribucion
                titulo="Distribución propuesta"
                distribucion={preview.data.impacto.distribucionDespues}
              />
            </div>

            <p className="mt-3 text-xs text-ink-soft">
              {preview.data.impacto.sinCambio} productores mantienen su segmento. Peso activo
              propuesto: <b>{numero(preview.data.pesoActivoPropuesto)}</b>.
            </p>
          </section>
        ) : (
          <div className="rounded-card border border-dashed border-line bg-panel-soft p-4 text-center">
            <p className="text-sm font-medium text-ink">Primero calculá el impacto.</p>
            <p className="mt-1 text-xs text-ink-soft">
              Guardar se habilita únicamente para la misma propuesta que acabás de revisar.
            </p>
          </div>
        )}

        <footer className="flex flex-col-reverse justify-end gap-2 border-t border-line pt-4 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={previsualizar}
            disabled={!hayCambios || !pesosValidos || pesoActivo <= 0 || procesando}
          >
            {preview.isPending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : null}
            {preview.isPending ? "Calculando impacto…" : "Calcular impacto"}
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={confirmarGuardado}
            disabled={!previewVigente || procesando}
          >
            {guardar.isPending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : null}
            {guardar.isPending ? "Guardando…" : "Guardar matriz"}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

function ImpactoDato({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: number;
  destacado?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-16 rounded-md border px-2 py-1.5",
        destacado ? "border-clementina-deep/30 bg-clementina/15" : "border-line bg-panel",
      )}
    >
      <div className="font-display text-lg font-semibold tabular text-ink">{valor}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink-soft">{etiqueta}</div>
    </div>
  );
}

function Distribucion({
  titulo,
  distribucion,
}: {
  titulo: string;
  distribucion: DistribucionSegmentacionDto;
}) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <h4 className="text-xs font-semibold text-ink">{titulo}</h4>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {SEGMENTOS.map((segmento) => {
          const cantidad = distribucion[segmento.toLowerCase() as Lowercase<Segmento>];
          return (
            <div
              key={segmento}
              className={cn("rounded-md border p-2 text-center", TONO_SEGMENTO[segmento])}
            >
              <div className="text-[10px] font-bold">{segmento}</div>
              <div className="font-display text-lg font-semibold tabular">{cantidad}</div>
            </div>
          );
        })}
      </div>
      {distribucion.sinScore > 0 ? (
        <p className="mt-2 text-[11px] text-ink-soft">
          Además, {distribucion.sinScore} sin score evaluable.
        </p>
      ) : null}
    </div>
  );
}
