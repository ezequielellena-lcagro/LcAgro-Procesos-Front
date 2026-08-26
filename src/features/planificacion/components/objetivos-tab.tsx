import { useMemo, useState } from "react";
import { AlertTriangle, Eye, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { toAppError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/shared/components/data-table";
import { KpiCard } from "@/shared/components/kpi-card";
import { oDash, pct, usd } from "@/shared/format/format";
import {
  useAcordarObjetivo,
  useGuardarObjetivos,
  usePrevisualizarObjetivos,
} from "../queries/use-objetivos";
import type {
  LineaObjetivoPlanificacion,
  ModoReparto,
  ObjetivoLineaDto,
  ObjetivosDto,
  ObjetivosRequest,
  ObjetivoVendedorDto,
} from "../types";
import { AvanceBar } from "./avance-bar";

interface Props {
  objetivos: ObjetivosDto;
  actualizando?: boolean;
}

/** Objetivos versionados: React edita un borrador; el servidor calcula preview y persistencia. */
export function ObjetivosTab({ objetivos, actualizando = false }: Props) {
  const [modo, setModo] = useState<ModoReparto>(objetivos.modoReparto);
  const [valores, setValores] = useState<Record<string, number>>(() =>
    Object.fromEntries(objetivos.lineas.map((linea) => [linea.linea, linea.valor])),
  );
  const [lineaSeleccionada, setLineaSeleccionada] = useState<LineaObjetivoPlanificacion>(
    objetivos.lineas.find((linea) => linea.esAgregada)?.linea ?? objetivos.lineas[0]?.linea,
  );
  const [acuerdo, setAcuerdo] = useState<ObjetivoVendedorDto>();

  const preview = usePrevisualizarObjetivos();
  const guardar = useGuardarObjetivos();

  const request = useMemo<ObjetivosRequest>(
    () => ({
      campania: objetivos.campania,
      revisionEsperada: objetivos.revision,
      modoReparto: modo,
      lineas: objetivos.lineas.map((linea) => ({
        linea: linea.linea,
        tipo: linea.tipo,
        valor: valores[linea.linea] ?? linea.valor,
        base: linea.base,
        proporcionBase: linea.proporcionBase,
        fuenteProporcion: linea.fuenteProporcion,
        esAgregada: linea.esAgregada,
      })),
    }),
    [modo, objetivos, valores],
  );

  const hayCambios =
    !objetivos.configurado ||
    modo !== objetivos.modoReparto ||
    objetivos.lineas.some((linea) => (valores[linea.linea] ?? linea.valor) !== linea.valor);
  const vista = preview.data ?? objetivos;
  const linea = vista.lineas.find((item) => item.linea === lineaSeleccionada) ?? vista.lineas[0];

  function cambiarModo(nuevo: ModoReparto) {
    setModo(nuevo);
    preview.reset();
  }

  function cambiarValor(lineaId: LineaObjetivoPlanificacion, valor: number) {
    setValores((actuales) => ({ ...actuales, [lineaId]: valor }));
    preview.reset();
  }

  function resetearBorrador() {
    setModo(objetivos.modoReparto);
    setValores(Object.fromEntries(objetivos.lineas.map((item) => [item.linea, item.valor])));
    preview.reset();
    guardar.reset();
  }

  async function previsualizarCambios() {
    try {
      await preview.mutateAsync(request);
    } catch (cause) {
      if (toAppError(cause).status === 409) resetearBorrador();
    }
  }

  async function guardarCambios() {
    try {
      const respuesta = await guardar.mutateAsync(request);
      if (respuesta.sinCambios) resetearBorrador();
    } catch (cause) {
      if (toAppError(cause).status === 409) resetearBorrador();
    }
  }

  const error = preview.error ?? guardar.error;

  if (!linea) {
    return (
      <div className="rounded-card border border-dashed border-line bg-panel p-8 text-center text-sm text-ink-soft">
        La campaña no tiene líneas de objetivo configuradas.
      </div>
    );
  }

  return (
    <div className="space-y-5" aria-busy={actualizando || preview.isPending || guardar.isPending}>
      <ComparacionObjetivoLc objetivos={vista} />

      <section className="rounded-card border border-line bg-panel p-4 shadow-card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              Objetivos de campaña {objetivos.campania}
            </h2>
            <p className="mt-1 text-xs text-ink-soft">
              Editás la meta de compañía; el servidor la baja a cada vendedor y conserva el total al
              centavo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hayCambios && !preview.data && (
              <span className="text-xs font-medium text-clementina-deep">
                Cambios sin previsualizar
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hayCambios || preview.isPending || guardar.isPending}
              onClick={() => void previsualizarCambios()}
            >
              <Eye className="size-4" />
              {preview.isPending ? "Calculando…" : "Previsualizar"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!hayCambios || !preview.data || guardar.isPending}
              onClick={() => void guardarCambios()}
            >
              <Save className="size-4" />
              {guardar.isPending ? "Guardando…" : "Guardar objetivos"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-3">
          {vista.lineas.map((item) => {
            const activa = item.linea === linea.linea;
            const valorBorrador = valores[item.linea] ?? item.valor;
            const porcentual = item.tipo === "crecimiento_porcentual";
            return (
              <button
                key={item.linea}
                type="button"
                onClick={() => setLineaSeleccionada(item.linea)}
                aria-pressed={activa}
                className={cn(
                  "rounded-md border p-3 text-left transition",
                  !item.medible
                    ? "border-dashed border-clementina-deep/40 bg-clementina/5"
                    : activa
                      ? "border-clementina-deep bg-clementina/10 ring-2 ring-clementina/30"
                      : "border-line bg-panel-soft hover:border-slate-brand/40",
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{item.nombre}</span>
                  <span className="font-display text-lg font-semibold tabular text-clementina-deep">
                    {porcentual ? crecimiento(valorBorrador) : usd(valorBorrador)}
                  </span>
                </div>
                {porcentual ? (
                  <input
                    type="range"
                    min={-10}
                    max={120}
                    step={1}
                    value={Math.round(valorBorrador * 100)}
                    onChange={(event) => cambiarValor(item.linea, Number(event.target.value) / 100)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Crecimiento de ${item.nombre}`}
                    className="h-1 w-full accent-clementina-deep"
                  />
                ) : (
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={valorBorrador}
                    onChange={(event) => cambiarValor(item.linea, Number(event.target.value))}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Objetivo de ${item.nombre}`}
                    className="h-8"
                  />
                )}
                <div className="mt-2 border-t border-line pt-2 text-xs">
                  {item.medible ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-ink-soft">Base {oDash(item.baseCompaniaUsd, usd)}</span>
                      <span className="font-medium tabular text-ink">
                        → {oDash(item.objetivoEfectivoUsd, usd)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-clementina-deep">
                      {item.motivoNoMedible ?? "Sin base desagregada para medir esta línea."}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              Modo de reparto
            </div>
            <div className="mt-1 flex gap-1 rounded-md border border-line bg-panel p-0.5">
              {(["plano", "oportunidad"] as ModoReparto[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => cambiarModo(item)}
                  aria-pressed={modo === item}
                  className={cn(
                    "rounded px-3 py-1.5 text-xs font-semibold transition",
                    modo === item
                      ? "bg-slate-brand text-white"
                      : "text-ink-soft hover:bg-panel-soft",
                  )}
                >
                  {item === "plano" ? "Mismo % para todos" : "Ajustado por oportunidad"}
                </button>
              ))}
            </div>
          </div>
          <p className="max-w-xl text-xs leading-relaxed text-ink-soft">
            El modo oportunidad cambia a quién se le exige el crecimiento, no el total de la
            compañía. Los acuerdos manuales ya vigentes se conservan al recalcular.
          </p>
        </div>

        {error && (
          <p className="mt-3 rounded-md border border-rojo/30 bg-rojo-bg p-3 text-xs text-rojo">
            {toAppError(error).message}
          </p>
        )}
      </section>

      {vista.avisos.map((aviso) => (
        <p
          key={aviso}
          className="rounded-md border border-clementina-deep/40 bg-clementina/10 p-3 text-xs text-ink"
        >
          <AlertTriangle className="mr-1 inline size-4 text-clementina-deep" /> {aviso}
        </p>
      ))}

      {vista.coherencia.hayContradiccion && (
        <p className="rounded-md border border-rojo/40 bg-rojo/5 p-3 text-xs leading-relaxed text-ink">
          <b className="text-rojo">Las líneas se contradicen.</b> El objetivo general obliga a Bayer
          a crecer{" "}
          <b>
            {oDash(vista.coherencia.crecimientoBayerImplicitoFraccion, (valor) =>
              crecimiento(valor),
            )}
          </b>
          , mientras las líneas Bayer declaran{" "}
          <b>
            {oDash(vista.coherencia.crecimientoBayerDeclaradoFraccion, (valor) =>
              crecimiento(valor),
            )}
          </b>
          . La advertencia no altera automáticamente ninguna meta.
        </p>
      )}

      {linea.medible ? (
        <DetalleLinea
          linea={linea}
          objetivos={vista}
          puedeAcordar={!hayCambios && !preview.data}
          onAcordar={setAcuerdo}
        />
      ) : (
        <div className="rounded-card border border-dashed border-line bg-panel p-6 text-center text-sm text-ink-soft">
          <b className="text-ink">{linea.nombre}</b> no se baja por vendedor:{" "}
          {linea.motivoNoMedible}
        </div>
      )}

      {acuerdo && (
        <AcuerdoDialog
          vendedor={acuerdo}
          linea={linea}
          objetivos={objetivos}
          onClose={() => setAcuerdo(undefined)}
        />
      )}
    </div>
  );
}

function DetalleLinea({
  linea,
  objetivos,
  puedeAcordar,
  onAcordar,
}: {
  linea: ObjetivoLineaDto;
  objetivos: ObjetivosDto;
  puedeAcordar: boolean;
  onAcordar: (vendedor: ObjetivoVendedorDto) => void;
}) {
  const filas = [...linea.vendedores].sort((a, b) => b.objetivoEfectivoUsd - a.objetivoEfectivoUsd);
  const totalBase = filas.reduce((total, fila) => total + fila.baseAnteriorUsd, 0);

  const columnas: Column<ObjetivoVendedorDto>[] = [
    {
      key: "vendedor",
      header: "Vendedor",
      cell: (fila) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{fila.vendedor}</div>
          <div className="text-xs text-ink-soft">
            {fila.productores ?? "—"} productores · capta{" "}
            {oDash(fila.participacionFraccion, (valor) => pct(valor * 100))}
          </div>
        </div>
      ),
    },
    {
      key: "base",
      header: `Cierre ${objetivos.campaniaBase}`,
      align: "right",
      cell: (fila) => usd(fila.baseAnteriorUsd),
    },
    {
      key: "crecimiento",
      header: "Crecimiento",
      align: "right",
      cell: (fila) => (
        <span className="font-medium tabular">{crecimiento(fila.crecimientoAplicadoFraccion)}</span>
      ),
    },
    {
      key: "derivado",
      header: "Derivado",
      align: "right",
      cell: (fila) => (
        <div>
          <div className="tabular">{usd(fila.objetivoDerivadoUsd)}</div>
          {Math.abs(fila.objetivoPlanoUsd - fila.objetivoDerivadoUsd) > 0.01 && (
            <div className="text-[10px] text-ink-soft">plano: {usd(fila.objetivoPlanoUsd)}</div>
          )}
        </div>
      ),
    },
    {
      key: "efectivo",
      header: `Objetivo ${objetivos.campania}`,
      align: "right",
      cell: (fila) => (
        <div>
          <div className="font-medium tabular">{usd(fila.objetivoEfectivoUsd)}</div>
          {fila.objetivoAcordadoUsd != null && (
            <div className="text-[10px] text-verde">
              acordado{fila.acordadoPor ? ` por ${fila.acordadoPor}` : ""}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "real",
      header: "Real a hoy",
      align: "right",
      cell: (fila) => oDash(fila.realAcumuladoUsd, usd),
    },
    {
      key: "avance",
      header: "Avance",
      cell: (fila) => (
        <AvanceBar
          avance={fila.avanceFraccion}
          esperado={objetivos.avanceEsperadoFraccion}
          motivoIndisponible={motivoAvanceIndisponible(
            fila.realAcumuladoUsd,
            fila.objetivoEfectivoUsd,
          )}
        />
      ),
    },
    {
      key: "accion",
      header: "",
      align: "right",
      cell: (fila) =>
        fila.fueraDeReparto ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!puedeAcordar}
            onClick={(event) => {
              event.stopPropagation();
              onAcordar(fila);
            }}
            title={
              puedeAcordar ? "Acordar objetivo" : "Guardá o descartá el borrador antes de acordar"
            }
          >
            <Pencil className="size-3.5" /> Acordar
          </Button>
        ),
    },
  ];

  const objetivo = linea.objetivoEfectivoUsd;
  const totalReal = linea.realCompaniaUsd;
  const avance =
    objetivo != null && objetivo > 0 && totalReal != null ? totalReal / objetivo : null;
  const proyeccion =
    totalReal != null && objetivos.avanceEsperadoFraccion > 0
      ? totalReal / objetivos.avanceEsperadoFraccion
      : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <KpiCard
          label={`Cierre ${objetivos.campaniaBase}`}
          value={usd(totalBase)}
          hint="base operativa del cálculo"
        />
        <KpiCard
          label={`Objetivo ${objetivos.campania}`}
          value={oDash(linea.objetivoEfectivoUsd, usd)}
          hint="incluye acuerdos vigentes"
        />
        <KpiCard
          label="Real a hoy"
          value={oDash(linea.realCompaniaUsd, usd)}
          tone={
            avance == null
              ? "default"
              : avance >= objetivos.avanceEsperadoFraccion
                ? "verde"
                : "rojo"
          }
          hint={`${oDash(avance, (valor) => pct(valor * 100))} del objetivo · esperado ${pct(objetivos.avanceEsperadoFraccion * 100)}`}
        />
        <KpiCard
          label="Proyección"
          value={oDash(proyeccion, usd)}
          tone={
            objetivo == null || proyeccion == null
              ? "default"
              : proyeccion >= objetivo
                ? "verde"
                : "rojo"
          }
          hint="al ritmo estacional de la campaña"
        />
      </div>

      <section>
        <div className="mb-2">
          <h2 className="font-display text-lg font-semibold text-ink">
            Bajada por vendedor — {linea.nombre}
          </h2>
          <p className="text-xs text-ink-soft">
            {filas.length} filas: vendedores habilitados más “Otros”. Los números derivan del juego
            vigente.
          </p>
        </div>
        <DataTable
          columns={columnas}
          rows={filas}
          getRowKey={(fila) => fila.vendedorCodigo ?? "otros"}
          empty="Esta línea no tiene vendedores evaluables."
          footer={[
            "Total",
            usd(totalBase),
            "",
            oDash(linea.objetivoCompaniaUsd, usd),
            oDash(linea.objetivoEfectivoUsd, usd),
            oDash(linea.realCompaniaUsd, usd),
            <AvanceBar
              key="avance-total"
              avance={avance}
              esperado={objetivos.avanceEsperadoFraccion}
              motivoIndisponible={motivoAvanceIndisponible(
                linea.realCompaniaUsd,
                linea.objetivoEfectivoUsd,
              )}
            />,
            "",
          ]}
        />
      </section>
    </div>
  );
}

function ComparacionObjetivoLc({ objetivos }: { objetivos: ObjetivosDto }) {
  const referencia = objetivos.referenciaHistorica;
  const lc = objetivos.lineas.find((linea) => linea.linea === "facturacion_lc");
  return (
    <section
      className="grid gap-3 lg:grid-cols-2"
      aria-label="Comparación de bases del objetivo LC"
    >
      <div className="rounded-card border border-verde/30 bg-verde/5 p-4 shadow-card">
        <div className="text-xs font-semibold uppercase tracking-wide text-verde">
          Dato operativo actual
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <Dato
            label={`Base ${objetivos.campaniaBase}`}
            valor={oDash(objetivos.fuenteOperativa.facturacionLcBaseUsd, usd)}
          />
          <Dato
            label={`Objetivo ${objetivos.campania}`}
            valor={oDash(lc?.objetivoCompaniaUsd, usd)}
          />
        </div>
        <p className="mt-2 text-xs text-ink-soft">{objetivos.fuenteOperativa.descripcion}</p>
      </div>
      <div className="rounded-card border border-slate-brand/25 bg-slate-brand/5 p-4 shadow-card">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-brand">
          Referencia histórica (Excel)
        </div>
        {referencia.disponible ? (
          <>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <Dato
                label={`Base ${referencia.campaniaBase ?? "histórica"}`}
                valor={oDash(referencia.facturacionLcUsd, usd)}
              />
              <Dato
                label="Objetivo LC +13 %"
                valor={oDash(referencia.objetivoLcMasTreceUsd, usd)}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-slate-brand">
              Referencia para conversar el corte: no se suma al dato operativo.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">
            No hay una referencia histórica disponible para esta campaña.
          </p>
        )}
      </div>
    </section>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-xs text-ink-soft">{label}</div>
      <div className="mt-0.5 font-display text-lg font-semibold tabular text-ink">{valor}</div>
    </div>
  );
}

function AcuerdoDialog({
  vendedor,
  linea,
  objetivos,
  onClose,
}: {
  vendedor: ObjetivoVendedorDto;
  linea: ObjetivoLineaDto;
  objetivos: ObjetivosDto;
  onClose: () => void;
}) {
  const [valor, setValor] = useState(vendedor.objetivoAcordadoUsd?.toString() ?? "");
  const [nota, setNota] = useState(vendedor.nota ?? "");
  const [errorValidacion, setErrorValidacion] = useState<string>();
  const acordar = useAcordarObjetivo();

  async function guardarAcuerdo() {
    const numero = valor.trim() === "" ? null : Number(valor);
    if (numero != null && (!Number.isFinite(numero) || numero < 0)) {
      setErrorValidacion("Ingresá un importe válido mayor o igual a cero.");
      return;
    }
    setErrorValidacion(undefined);
    try {
      await acordar.mutateAsync({
        campania: objetivos.campania,
        linea: linea.linea,
        vendedorCodigo: vendedor.vendedorCodigo,
        revisionEsperada: objetivos.revision,
        valorAcordado: numero,
        nota: nota.trim() || null,
      });
      onClose();
    } catch (cause) {
      if (toAppError(cause).status === 409) onClose();
      // Los demás errores quedan visibles; no se pierde el borrador.
    }
  }

  return (
    <Modal open onClose={onClose} title="Acordar objetivo" className="w-full max-w-lg">
      <div className="space-y-4 p-5">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">{vendedor.vendedor}</h2>
          <p className="text-sm text-ink-soft">
            {linea.nombre} · campaña {objetivos.campania}
          </p>
        </div>
        <div className="rounded-md border border-line bg-panel-soft p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-ink-soft">Objetivo derivado</span>
            <b>{usd(vendedor.objetivoDerivadoUsd)}</b>
          </div>
          {vendedor.objetivoAcordadoUsd != null && (
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-ink-soft">Acordado vigente</span>
              <b>{usd(vendedor.objetivoAcordadoUsd)}</b>
            </div>
          )}
        </div>
        <label className="block text-sm font-medium text-ink">
          Objetivo acordado (USD)
          <Input
            type="number"
            min={0}
            step={0.01}
            value={valor}
            onChange={(event) => {
              setValor(event.target.value);
              setErrorValidacion(undefined);
            }}
            aria-invalid={Boolean(errorValidacion)}
            aria-describedby={errorValidacion ? "objetivo-acordado-error" : undefined}
            placeholder="Vacío = volver al objetivo derivado"
            className="mt-1"
          />
        </label>
        {errorValidacion && (
          <p id="objetivo-acordado-error" role="alert" className="text-xs text-rojo">
            {errorValidacion}
          </p>
        )}
        <label className="block text-sm font-medium text-ink">
          Nota
          <Textarea
            value={nota}
            onChange={(event) => setNota(event.target.value)}
            className="mt-1"
            maxLength={500}
          />
        </label>
        {acordar.error && (
          <p className="rounded-md border border-rojo/30 bg-rojo-bg p-3 text-xs text-rojo">
            {toAppError(acordar.error).message}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={acordar.isPending} onClick={() => void guardarAcuerdo()}>
            {acordar.isPending ? "Guardando…" : "Guardar acuerdo"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function crecimiento(valor: number): string {
  return `${valor >= 0 ? "+" : ""}${pct(valor * 100)}`;
}

function motivoAvanceIndisponible(real: number | null, objetivo: number | null): string {
  if (real == null) return "sin dato actual";
  if (objetivo == null || objetivo <= 0) return "sin objetivo positivo";
  return "sin avance disponible";
}
