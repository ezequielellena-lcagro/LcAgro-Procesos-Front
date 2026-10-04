import { useCallback, useRef, useState } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { toAppError } from "@/lib/api-error";
import { fechaHoraArgentina } from "../format";
import { confirmacionPendiente } from "../lib/comandos";
import {
  cuitFlota,
  fichaFlotaValida,
  importeEntradaFlota,
  textoFlotaValido,
  trimFlota,
} from "../lib/flota";
import { useOperacion } from "../queries/use-logistica";
import type {
  BajaFichaFlotaRequest,
  EditarFichaFlotaRequest,
  FichaFlotaDto,
  FichaFlotaRequest,
  MonedaFlota,
} from "../types";
import { Campo, FormOperacionFooter } from "./form-operacion";

export type ModoFichaFlota = "crear" | "editar" | "baja" | "detalle";
export function FichaFlotaDialog({
  dato,
  modo,
  onClose,
  onConflict,
}: {
  dato?: FichaFlotaDto;
  modo: ModoFichaFlota;
  onClose: () => void;
  onConflict: () => void;
}) {
  const [snapshot] = useState(() => (dato ? structuredClone(dato) : null));
  const original = snapshot?.ficha;
  const [chasis, setChasis] = useState(original?.patenteChasis ?? "");
  const [acoplado, setAcoplado] = useState(original?.patenteAcoplado ?? "");
  const [conductor, setConductor] = useState(original?.conductor ?? "");
  const [cuitConductor, setCuitConductor] = useState(original?.cuitConductor ?? "");
  const [transportista, setTransportista] = useState(original?.transportista ?? "");
  const [cuitTransportista, setCuitTransportista] = useState(original?.cuitTransportista ?? "");
  const [importe, setImporte] = useState(original?.importeReferencia?.replace(".", ",") ?? "");
  const [moneda, setMoneda] = useState<MonedaFlota | "">(original?.moneda ?? "");
  const [vigenteDesde, setVigenteDesde] = useState(original?.vigenteDesde ?? "");
  const [motivo, setMotivo] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [confirmacionIncierta, setConfirmacionIncierta] = useState(false);
  const intento = useRef<
    FichaFlotaRequest | EditarFichaFlotaRequest | BajaFichaFlotaRequest | null
  >(null);
  const ruta =
    modo === "crear" ? "flota" : "flota/" + snapshot?.id + (modo === "baja" ? "/baja" : "");
  const mutation = useOperacion<FichaFlotaDto>(ruta, modo === "editar" ? "put" : "post");
  const incierto = confirmacionIncierta || confirmacionPendiente(mutation.error);
  const protegido = mutation.isPending || incierto;
  const blocker = useBlocker(protegido);
  useBeforeUnload(
    useCallback(
      (e) => {
        if (!protegido) return;
        e.preventDefault();
        e.returnValue = "";
      },
      [protegido],
    ),
  );
  const cerrar = () => {
    if (!protegido) onClose();
  };
  const soloLectura = modo === "detalle" || modo === "baja";
  const opcional = (valor: string) => (valor === "" ? null : valor);
  const enviar = async () => {
    if (mutation.isPending || modo === "detalle") return;
    if (!intento.current) {
      const precio = importeEntradaFlota(importe);
      const ficha: FichaFlotaRequest = {
        patenteChasis: chasis,
        patenteAcoplado: opcional(acoplado),
        conductor: opcional(conductor),
        cuitConductor: opcional(cuitConductor),
        transportista: opcional(transportista),
        cuitTransportista: opcional(cuitTransportista),
        importeReferencia: precio ?? null,
        moneda: moneda || null,
        vigenteDesde: vigenteDesde || null,
      };
      if (
        (modo !== "baja" && (precio === undefined || !fichaFlotaValida(ficha))) ||
        (modo !== "crear" && (!snapshot?.activo || !textoFlotaValido(motivo, 500)))
      ) {
        setInvalid(true);
        return;
      }
      ficha.patenteChasis = trimFlota(ficha.patenteChasis);
      ficha.cuitConductor = cuitFlota(ficha.cuitConductor);
      ficha.cuitTransportista = cuitFlota(ficha.cuitTransportista);
      intento.current = structuredClone(
        modo === "crear"
          ? ficha
          : modo === "editar"
            ? { revision: snapshot!.revision, ficha, motivo: trimFlota(motivo) }
            : { revision: snapshot!.revision, motivo: trimFlota(motivo) },
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
  const titulo =
    modo === "crear"
      ? "Nueva ficha de flota"
      : modo === "editar"
        ? "Editar ficha de flota"
        : modo === "baja"
          ? "Dar de baja ficha de flota"
          : "Detalle de ficha de flota";
  return (
    <Modal open title={titulo} onClose={cerrar} className="max-w-3xl">
      {snapshot && (
        <div className="mb-4 space-y-1 rounded-md border border-line bg-secondary p-3 text-xs text-ink-soft">
          <p className="font-medium text-ink">
            {snapshot.activo ? "Activa" : "Inactiva"} · Revisión {snapshot.revision}
          </p>
          <p>
            Creada por Usuario {snapshot.creadoPorId} · {fechaHoraArgentina(snapshot.creadoAl)}
          </p>
          <p>
            Actualizada por Usuario {snapshot.actualizadoPorId} ·{" "}
            {fechaHoraArgentina(snapshot.actualizadoAl)}
          </p>
          <p className="break-all">Versión {snapshot.versionId}</p>
        </div>
      )}
      {snapshot?.patenteChasisRepetida && (
        <p
          role="status"
          className="mb-4 rounded-md border border-clementina-deep/40 bg-clementina/10 p-3 text-sm"
        >
          Hay otra ficha activa con esta patente de chasis.
        </p>
      )}
      {modo === "baja" && (
        <p className="mb-4 text-sm">
          La ficha quedará inactiva. Sus versiones y el historial se conservan.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <fieldset disabled={enviado || soloLectura} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo titulo="Patente de chasis">
              <Input value={chasis} maxLength={20} onChange={(e) => setChasis(e.target.value)} />
            </Campo>
            <Campo titulo="Patente de acoplado">
              <Input
                value={acoplado}
                maxLength={20}
                onChange={(e) => setAcoplado(e.target.value)}
              />
            </Campo>
            <Campo titulo="Conductor">
              <Input
                value={conductor}
                maxLength={150}
                onChange={(e) => setConductor(e.target.value)}
              />
            </Campo>
            <Campo titulo="CUIT del conductor">
              <Input value={cuitConductor} onChange={(e) => setCuitConductor(e.target.value)} />
            </Campo>
            <Campo titulo="Transportista">
              <Input
                value={transportista}
                maxLength={200}
                onChange={(e) => setTransportista(e.target.value)}
              />
            </Campo>
            <Campo titulo="CUIT del transportista">
              <Input
                value={cuitTransportista}
                onChange={(e) => setCuitTransportista(e.target.value)}
              />
            </Campo>
          </div>
          <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <Campo titulo="Importe de referencia">
              <Input
                inputMode="decimal"
                value={importe}
                maxLength={64}
                onChange={(e) => setImporte(e.target.value)}
              />
            </Campo>
            <Campo titulo="Moneda">
              <select
                className="h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink"
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as MonedaFlota | "")}
              >
                <option value="">Seleccionar moneda</option>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </Campo>
            <Campo titulo="Vigente desde">
              <Input
                type="date"
                min="1753-01-01"
                max="9999-12-31"
                value={vigenteDesde}
                onChange={(e) => setVigenteDesde(e.target.value)}
              />
            </Campo>
          </div>
        </fieldset>
        {modo !== "detalle" && (
          <>
            {modo !== "crear" && (
              <fieldset disabled={enviado} className="mt-5">
                <Campo titulo={modo === "editar" ? "Motivo de la edición" : "Motivo de la baja"}>
                  <Input
                    value={motivo}
                    maxLength={500}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </Campo>
              </fieldset>
            )}
            <FormOperacionFooter
              error={mutation.error}
              invalid={invalid}
              pending={mutation.isPending}
              confirmacionIncierta={incierto}
              onClose={cerrar}
              texto={
                modo === "crear"
                  ? "Guardar ficha"
                  : modo === "editar"
                    ? "Guardar cambios"
                    : "Confirmar baja"
              }
            />
          </>
        )}
        {modo === "detalle" && (
          <div className="mt-5 flex justify-end border-t border-line pt-4">
            <Button type="button" variant="outline" onClick={cerrar}>
              Cerrar detalle
            </Button>
          </div>
        )}
      </form>
      {(incierto || blocker.state === "blocked") && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          Confirmá el resultado antes de salir. Conservamos los datos y la revisión de este intento
          para reintentar.
        </p>
      )}
    </Modal>
  );
}
