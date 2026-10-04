import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { fechaHoraArgentina } from "../format";
import { columnasCamion } from "../lib/flota-seguimiento";
import { textoFlotaValido, trimFlota } from "../lib/flota";
import { identificacionSeguimiento } from "../lib/seguimiento";
import {
  useConfirmacionFlota,
  useFlotaSeguimiento,
  useSeleccionarFlotaSeguimiento,
} from "../queries/use-logistica-flota-seguimiento";
import type { FlotaSeguimientoDto, Seguimiento, SeleccionarFlotaSeguimientoBody } from "../types";
import { Campo, FormOperacionFooter } from "./form-operacion";
import { TablaLogistica } from "./tabla-logistica";

export function FlotaSeguimientoDialog({
  seguimiento,
  onClose,
  onConflict,
}: {
  seguimiento: Seguimiento;
  onClose: () => void;
  onConflict: () => void;
}) {
  const [snapshot] = useState(() => structuredClone(seguimiento));
  const actual = snapshot.flotaVigente ?? null;
  const reemplazar = actual !== null;
  const [buscar, setBuscar] = useState("");
  const [aplicado, setAplicado] = useState("");
  const [aplicacion, setAplicacion] = useState(0);
  const [seleccion, setSeleccion] = useState<FlotaSeguimientoDto | null>(null);
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const mutation = useSeleccionarFlotaSeguimiento(snapshot.cupoId);
  const intento = useConfirmacionFlota(mutation, onClose, onConflict);
  const q = useFlotaSeguimiento(aplicado, aplicacion, !intento.enviado);
  const lecturaActual = q.isFetchedAfterMount && !q.isFetching && q.error == null;
  const mismaVersion = (f: FlotaSeguimientoDto) => actual?.versionId === f.versionId;
  const enviar = async () => {
    if (
      !intento.enviado &&
      (!seleccion ||
        mismaVersion(seleccion) ||
        !lecturaActual ||
        snapshot.anuladoAl ||
        !confirmado ||
        (reemplazar && !textoFlotaValido(motivo, 500)))
    ) {
      setInvalid(true);
      return;
    }
    if (!seleccion) return;
    setInvalid(false);
    const body: SeleccionarFlotaSeguimientoBody = {
      revision: snapshot.revision,
      fichaId: seleccion.fichaId,
      versionId: seleccion.versionId,
      motivo: reemplazar ? trimFlota(motivo) : null,
    };
    await intento.enviar(body);
  };
  return (
    <Modal
      open
      title={reemplazar ? "Reemplazar camión" : "Elegir camión"}
      onClose={intento.cerrar}
      className="max-w-7xl"
    >
      <p className="mb-3 text-sm text-ink-soft">{identificacionSeguimiento(snapshot)}</p>
      <p className="mb-4 text-sm">
        Elegí un camión del padrón activo y revisá su versión antes de confirmar. El importe de
        referencia manual se conserva con esa versión.
      </p>
      {actual && (
        <div className="mb-4">
          <TablaLogistica
            titulo="Camión vigente a reemplazar"
            filas={[actual]}
            clave={(f) => f.versionId}
            columnas={columnasCamion()}
          />
        </div>
      )}
      <fieldset disabled={intento.enviado}>
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const texto = trimFlota(buscar);
            if (texto !== "" && !textoFlotaValido(buscar, 200)) {
              setInvalid(true);
              return;
            }
            setInvalid(false);
            setAplicado(texto);
            setAplicacion((v) => v + 1);
            setSeleccion(null);
            setConfirmado(false);
          }}
        >
          <Campo titulo="Buscar camión">
            <Input value={buscar} maxLength={200} onChange={(e) => setBuscar(e.target.value)} />
          </Campo>
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
      </fieldset>
      <TablaLogistica
        titulo="Camiones disponibles"
        filas={
          q.data?.pages.flatMap((p) => p.filas.map((f) => ({ ...f, consultadoAl: p.datosAl }))) ??
          []
        }
        clave={(f) => f.fichaId + "/" + f.versionId}
        cargando={q.isLoading}
        error={q.error}
        reintentar={!intento.enviado ? () => void q.refetch() : undefined}
        hayMas={!intento.enviado && q.hasNextPage && q.error == null}
        mas={() => void q.fetchNextPage()}
        cargandoMas={q.isFetchingNextPage}
        vacio="No hay camiones activos para esta búsqueda."
        columnas={[
          {
            titulo: "Elegir",
            celda: (f) => (
              <div>
                <input
                  type="radio"
                  name="camion-elegido"
                  aria-label={
                    "Elegir " +
                    f.patenteChasis +
                    ", ficha " +
                    f.fichaId +
                    ", versión " +
                    f.versionId
                  }
                  checked={seleccion?.fichaId === f.fichaId && seleccion.versionId === f.versionId}
                  disabled={intento.enviado || !lecturaActual || mismaVersion(f)}
                  onChange={() => {
                    setSeleccion(structuredClone(f));
                    setConfirmado(false);
                  }}
                />
                {mismaVersion(f) && <p className="mt-1 text-xs text-ink-soft">Camión vigente</p>}
              </div>
            ),
          },
          ...columnasCamion(),
          { titulo: "Consultado al (Argentina)", celda: (f) => fechaHoraArgentina(f.consultadoAl) },
        ]}
      />
      {seleccion && (
        <div className="mt-5">
          <h3 className="mb-3 font-display text-lg">Revisar camión elegido</h3>
          <TablaLogistica
            titulo="Camión a confirmar"
            filas={[seleccion]}
            clave={(f) => f.versionId}
            columnas={columnasCamion()}
          />
          <p className="mt-3 text-sm text-ink-soft">
            Confirmar conserva esta versión de la ficha para el viaje. Si la ficha cambió, será
            necesario revisar el padrón actualizado y realizar un nuevo intento.
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
        <fieldset disabled={intento.enviado} className="space-y-4">
          {reemplazar && (
            <Campo titulo="Motivo del reemplazo">
              <Input value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
            </Campo>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
            Revisé el camión y la versión elegida
          </label>
        </fieldset>
        <FormOperacionFooter
          error={mutation.error}
          invalid={invalid}
          pending={mutation.isPending}
          confirmacionIncierta={intento.incierto}
          onClose={intento.cerrar}
          texto={reemplazar ? "Reemplazar camión" : "Confirmar camión"}
        />
      </form>
      {(intento.incierto || intento.bloqueada) && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          Confirmá el resultado antes de salir. Conservamos el camión, la versión, el motivo y la
          revisión de este intento para reintentar.
        </p>
      )}
    </Modal>
  );
}
