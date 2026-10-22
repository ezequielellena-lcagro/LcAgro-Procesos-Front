import { useCallback, useRef, useState } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { toAppError } from "@/lib/api-error";
import { fecha, fechaHoraArgentina, sumarDias } from "../format";
import { confirmacionPendiente } from "../lib/comandos";
import {
  incidenciasErp,
  INCIDENCIA_LABEL,
  referenciaErp,
  textoPresente,
} from "../lib/conciliacion";
import {
  datoVigente,
  destinatarioSeguimiento,
  diferenciaPeso,
  identificacionSeguimiento,
  kgErp,
  kgOperativos,
  textoOperativoValido,
} from "../lib/seguimiento";
import { useListado, useOperacion } from "../queries/use-logistica";
import type {
  CandidatoErp,
  Seguimiento,
  ReemplazarVinculoErpBody,
  VinculoErpBody,
  VinculoErpResultado,
} from "../types";
import { Campo, FormOperacionFooter } from "./form-operacion";
import { PeriodoFiltro } from "./periodo-filtro";
import { TablaLogistica } from "./tabla-logistica";

export function VinculoErpDialog({
  seguimiento,
  modo = "vincular",
  onClose,
  onConflict,
}: {
  seguimiento: Seguimiento;
  modo?: "vincular" | "reemplazar";
  onClose: () => void;
  onConflict: () => void;
}) {
  const [snapshot] = useState(() => structuredClone(seguimiento));
  const codigoConocido = textoPresente(snapshot.cupo.codigoTerminal);
  const [periodo, setPeriodo] = useState(() => ({
    desde: sumarDias(snapshot.cupo.fechaCarga, -7),
    hastaExclusivo: sumarDias(snapshot.cupo.fechaCarga, 8),
  }));
  const [grupo, setGrupo] = useState("");
  const [grupoAplicado, setGrupoAplicado] = useState("");
  const [ampliar, setAmpliar] = useState(false);
  const [paginaVersion, setPaginaVersion] = useState(0);
  const [seleccion, setSeleccion] = useState<CandidatoErp | null>(null);
  const [evidencia, setEvidencia] = useState("");
  const [motivo, setMotivo] = useState("");
  const reemplazar = modo === "reemplazar";
  const actual = snapshot.vinculoErpVigente;
  const [confirmado, setConfirmado] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [confirmacionIncierta, setConfirmacionIncierta] = useState(false);
  const intento = useRef<VinculoErpBody | ReemplazarVinculoErpBody | null>(null);
  const mutation = useOperacion<VinculoErpResultado>(
    `cupos/${snapshot.cupoId}/vinculo-erp${reemplazar ? "/reemplazar" : ""}`,
    reemplazar ? "post" : "put",
  );
  const mismaReferencia = (candidato: CandidatoErp) =>
    !!actual && referenciaErp(candidato.erp) === referenciaErp(actual);
  const incierto = confirmacionIncierta || confirmacionPendiente(mutation.error);
  const protegido = mutation.isPending || incierto;
  const blocker = useBlocker(protegido);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (!protegido) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [protegido],
    ),
  );
  const q = useListado<CandidatoErp>(
    `cupos/${snapshot.cupoId}/candidatos-erp`,
    {
      ...periodo,
      porCodigo: codigoConocido && !ampliar,
      ...(grupoAplicado !== "" ? { grupo: Number(grupoAplicado) } : {}),
    },
    (f) => ({ despuesGrupo: f.erp.grupo, despuesCupo: f.erp.cupo }),
    !enviado,
    { paginaVersion },
    20,
  );
  const reiniciar = () => {
    setSeleccion(null);
    setPaginaVersion((v) => v + 1);
  };
  const cerrar = () => {
    if (!protegido) onClose();
  };
  const enviar = async () => {
    if (mutation.isPending) return;
    if (!intento.current) {
      if (
        !seleccion ||
        seleccion.ocupado ||
        !seleccion.erp.tieneCabecera ||
        q.isFetching ||
        q.error != null ||
        !textoOperativoValido(evidencia, 500) ||
        (reemplazar &&
          (!actual || mismaReferencia(seleccion) || !textoOperativoValido(motivo, 500))) ||
        !confirmado
      ) {
        setInvalid(true);
        return;
      }
      const erp = seleccion.erp;
      const clave = { contrato: erp.contrato, grupo: erp.grupo, cupo: erp.cupo };
      intento.current = structuredClone(
        reemplazar
          ? {
              revision: snapshot.cupo.revision,
              vinculoActualId: actual!.id,
              claveNueva: clave,
              evidencia: evidencia.trim(),
              motivo: motivo.trim(),
              confirmado: true,
            }
          : {
              revision: snapshot.cupo.revision,
              clave,
              evidencia: evidencia.trim(),
              confirmado: true,
            },
      );
    }
    setInvalid(false);
    setEnviado(true);
    try {
      await mutation.mutateAsync(intento.current);
      setConfirmacionIncierta(false);
      onClose();
    } catch (error) {
      if (toAppError(error).status === 409) {
        setConfirmacionIncierta(false);
        onConflict();
      } else if (confirmacionPendiente(error)) setConfirmacionIncierta(true);
    }
  };
  const elegido = seleccion?.erp;
  const patente = datoVigente(snapshot, "patente")?.texto ?? null;
  const comparaciones = elegido
    ? [
        {
          dato: "Código terminal",
          propio: snapshot.cupo.codigoTerminal ?? "Pendiente",
          erp: elegido.codigoTerminal ?? "Pendiente",
          comparacion:
            !textoPresente(snapshot.cupo.codigoTerminal) || !textoPresente(elegido.codigoTerminal)
              ? "Sin comparación"
              : snapshot.cupo.codigoTerminal === elegido.codigoTerminal
                ? "Coincide"
                : "Diferencia entre fuentes",
        },
        {
          dato: "Fecha de carga",
          propio: fecha(snapshot.cupo.fechaCarga),
          erp: fecha(elegido.fechaCarga),
          comparacion:
            elegido.fechaCarga == null
              ? "Sin comparación"
              : snapshot.cupo.fechaCarga === elegido.fechaCarga.slice(0, 10)
                ? "Coincide"
                : "Diferencia entre fuentes",
        },
        {
          dato: "Destino",
          propio: `${snapshot.cupo.destinoNombre ?? "Destino"} (${snapshot.cupo.destinoCodigo})`,
          erp:
            elegido.destinoCodigo == null
              ? "Sin dato"
              : `${elegido.destinoNombre ?? "Destino"} (${elegido.destinoCodigo})`,
          comparacion:
            elegido.destinoCodigo == null
              ? "Sin comparación"
              : snapshot.cupo.destinoCodigo === elegido.destinoCodigo
                ? "Coincide"
                : "Diferencia entre fuentes",
        },
        {
          dato: "Patente",
          propio: patente ?? "Pendiente",
          erp: textoPresente(elegido.patenteChasis) ? elegido.patenteChasis : "Sin dato",
          comparacion:
            !textoPresente(patente) || !textoPresente(elegido.patenteChasis)
              ? "Sin comparación"
              : patente === elegido.patenteChasis
                ? "Coincide"
                : "Diferencia entre fuentes",
        },
        ...(["kg_carga", "kg_descarga"] as const).map((tipo) => {
          const peso = datoVigente(snapshot, tipo)?.kilogramos ?? null;
          const oficial = tipo === "kg_carga" ? elegido.kgCargaErp : elegido.kgDescargaErp;
          return {
            dato: tipo === "kg_carga" ? "Peso de carga" : "Peso de descarga",
            propio: kgOperativos(peso),
            erp: kgErp(oficial),
            comparacion: diferenciaPeso(peso, oficial),
          };
        }),
      ]
    : [];
  return (
    <Modal
      open
      title={reemplazar ? "Reemplazar referencia" : "Vincular con MacroGest"}
      onClose={cerrar}
      className="max-w-7xl"
    >
      <p className="mb-3 text-sm text-ink-soft">{identificacionSeguimiento(snapshot)}</p>
      <p className="mb-4 text-sm">
        Revisá ambas fuentes antes de confirmar la referencia. El productor y el cargador del plan
        se muestran por código; la asignación propia se conserva.
      </p>
      {reemplazar && actual && (
        <div className="mb-4">
          <p className="mb-3 text-sm">
            Esta corrección conserva el otorgamiento y el viaje. Elegí una referencia diferente del
            mismo contrato y registrá la evidencia y el motivo.
          </p>
          <TablaLogistica
            titulo="Referencias de la corrección"
            filas={[
              { referencia: "Vigente a reemplazar", ...actual },
              ...(seleccion
                ? [{ referencia: "Nueva elegida", id: "Se genera al confirmar", ...seleccion.erp }]
                : []),
            ]}
            clave={(f) => f.referencia}
            columnas={[
              { titulo: "Referencia", celda: (f) => f.referencia },
              { titulo: "ID del vínculo", celda: (f) => f.id },
              { titulo: "Contrato", celda: (f) => f.contrato },
              { titulo: "Plan de carga", numero: true, celda: (f) => f.grupo },
              { titulo: "Cupo", numero: true, celda: (f) => f.cupo },
            ]}
          />
        </div>
      )}
      <TablaLogistica
        titulo="Operación propia a vincular"
        filas={[snapshot]}
        clave={(s) => s.cupoId}
        columnas={[
          { titulo: "Contrato propio", celda: (s) => s.cupo.contratoVenta },
          {
            titulo: "Recepción / fila",
            celda: (s) => `${s.referenciaRecepcion} / fila ${s.cupo.ordinal}`,
          },
          {
            titulo: "Código terminal",
            celda: (s) =>
              textoPresente(s.cupo.codigoTerminal) ? s.cupo.codigoTerminal : "Código pendiente",
          },
          { titulo: "Fecha prevista de carga", celda: (s) => fecha(s.cupo.fechaCarga) },
          {
            titulo: "Destino",
            celda: (s) => `${s.cupo.destinoNombre ?? "Destino"} (${s.cupo.destinoCodigo})`,
          },
          { titulo: "Asignación propia", celda: destinatarioSeguimiento },
        ]}
      />
      <fieldset
        disabled={enviado}
        onChangeCapture={() => {
          if (!enviado) setSeleccion(null);
        }}
        className="mt-5"
      >
        <PeriodoFiltro
          value={periodo}
          maxDias={31}
          etiqueta="Fecha de carga"
          onChange={(p) => {
            setPeriodo(p);
            reiniciar();
          }}
        />
        <form
          className="mb-3 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (grupo === "" || (/^\d+$/.test(grupo) && Number(grupo) <= 99999999)) {
              setGrupoAplicado(grupo);
              reiniciar();
            }
          }}
        >
          <Campo titulo="Plan de carga (opcional)">
            <Input
              type="number"
              min={0}
              max={99999999}
              step={1}
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
            />
          </Campo>
          <Button type="submit" variant="outline">
            Buscar grupo
          </Button>
        </form>
        {codigoConocido ? (
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ampliar}
              onChange={(e) => {
                setAmpliar(e.target.checked);
                reiniciar();
              }}
            />
            Ampliar a otros códigos del mismo contrato
          </label>
        ) : (
          <p className="mb-3 text-sm text-ink-soft">
            Código propio pendiente. Buscamos por contrato, período y número de plan; no se genera un
            código.
          </p>
        )}
      </fieldset>
      <p className="mb-3 text-sm text-ink-soft">
        Contrato fijo: {snapshot.cupo.contratoVenta}. Fecha de carga de MacroGest, hasta 31 días. Una página
        vacía no acredita ausencia histórica. El número de plan no identifica por sí solo un plan de carga.
      </p>
      <TablaLogistica
        titulo="Referencias candidatas de MacroGest"
        filas={
          q.data?.pages.flatMap((p) => p.filas.map((f) => ({ ...f, consultadoAl: p.datosAl }))) ??
          []
        }
        clave={(f) => referenciaErp(f.erp)}
        cargando={q.isLoading}
        error={q.error}
        reintentar={
          !enviado
            ? () => {
                setSeleccion(null);
                void q.refetch();
              }
            : undefined
        }
        hayMas={!enviado && q.hasNextPage}
        cargandoMas={q.isFetchingNextPage}
        mas={() => {
          setSeleccion(null);
          void q.fetchNextPage();
        }}
        vacio="No hay referencias para este contrato, período y filtros. Revisá las fechas o ampliá la búsqueda."
        columnas={[
          {
            titulo: "Seleccionar",
            celda: (f) => (
              <div>
                <input
                  type="radio"
                  name="referencia-erp"
                  aria-label={`Seleccionar ${referenciaErp(f.erp)}`}
                  checked={!!seleccion && referenciaErp(seleccion.erp) === referenciaErp(f.erp)}
                  disabled={
                    enviado ||
                    q.isFetching ||
                    q.error != null ||
                    f.ocupado ||
                    !f.erp.tieneCabecera ||
                    (reemplazar && mismaReferencia(f))
                  }
                  onChange={() => setSeleccion(structuredClone(f))}
                />
                {reemplazar && mismaReferencia(f) && (
                  <p className="mt-1 text-xs text-ink-soft">Referencia vigente</p>
                )}
                {f.ocupado && <p className="mt-1 text-xs text-rojo">Vinculada a otro cupo</p>}
                {!f.erp.tieneCabecera && (
                  <p className="mt-1 text-xs text-ink-soft">Requiere cabecera</p>
                )}
              </div>
            ),
          },
          { titulo: "Referencia completa", celda: (f) => referenciaErp(f.erp) },
          {
            titulo: "Código",
            celda: (f) =>
              textoPresente(f.erp.codigoTerminal) ? f.erp.codigoTerminal : "Código pendiente",
          },
          { titulo: "Fecha de carga", celda: (f) => fecha(f.erp.fechaCarga) },
          {
            titulo: "Destino",
            celda: (f) =>
              f.erp.destinoCodigo == null
                ? "Sin dato"
                : `${f.erp.destinoNombre ?? "Destino"} (${f.erp.destinoCodigo})`,
          },
          { titulo: "Cabecera", celda: (f) => (f.erp.tieneCabecera ? "Presente" : "Pendiente") },
          {
            titulo: "Productor del plan (código)",
            numero: true,
            celda: (f) => f.erp.productorPlan ?? "Sin dato",
          },
          {
            titulo: "Cargador del plan (código)",
            numero: true,
            celda: (f) => f.erp.cargadorPlan ?? "Sin dato",
          },
          {
            titulo: "Planta trabajo / detalle (códigos)",
            numero: true,
            celda: (f) =>
              `${f.erp.plantaTrabajo ?? "Sin dato"} / ${f.erp.plantaDetalle ?? "Sin dato"}`,
          },
          {
            titulo: "Carta de Porte",
            celda: (f) => (f.erp.tieneCartaPorte ? "Presente" : "Pendiente"),
          },
          {
            titulo: "Descarga documentada",
            celda: (f) => (f.erp.tieneDescarga ? "Presente" : "Pendiente"),
          },
          { titulo: "Consultado al (Argentina)", celda: (f) => fechaHoraArgentina(f.consultadoAl) },
        ]}
      />
      {elegido && (
        <div className="mt-5">
          <h3 className="mb-3 font-display text-lg">
            Comparación previa: {referenciaErp(elegido)}
          </h3>
          <TablaLogistica
            titulo="Comparación previa de fuentes"
            filas={comparaciones}
            clave={(f) => f.dato}
            columnas={[
              { titulo: "Dato", celda: (f) => f.dato },
              { titulo: "Operación propia", numero: true, celda: (f) => f.propio },
              { titulo: "MacroGest", numero: true, celda: (f) => f.erp },
              { titulo: "Comparación", numero: true, celda: (f) => f.comparacion },
            ]}
          />
          <p className="mt-3 text-sm text-ink-soft">
            {incidenciasErp(snapshot, elegido)
              .map((c) => INCIDENCIA_LABEL[c])
              .join("; ") || "Sin diferencias detectadas"}
          </p>
        </div>
      )}
      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          void enviar();
        }}
      >
        <fieldset disabled={enviado} className="space-y-4">
          <Campo titulo={reemplazar ? "Evidencia de la corrección" : "Evidencia de la vinculación"}>
            <Input
              value={evidencia}
              maxLength={500}
              onChange={(e) => setEvidencia(e.target.value)}
            />
          </Campo>
          {reemplazar && (
            <Campo titulo="Motivo de la corrección">
              <Input value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
            </Campo>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
            Revisé la referencia completa y los datos de ambas fuentes
          </label>
        </fieldset>
        <FormOperacionFooter
          error={mutation.error}
          invalid={invalid}
          pending={mutation.isPending}
          confirmacionIncierta={incierto}
          onClose={cerrar}
          texto={reemplazar ? "Reemplazar referencia" : "Vincular referencia"}
        />
      </form>
      {(incierto || blocker.state === "blocked") && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          Confirmá el resultado antes de salir. Conservamos la referencia, la evidencia y la
          revisión de este intento para reintentar.
        </p>
      )}
    </Modal>
  );
}
