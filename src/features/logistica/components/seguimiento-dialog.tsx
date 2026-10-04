import { useCallback, useRef, useState } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { toAppError } from "@/lib/api-error";
import { ahoraArgentinaInput, instanteArgentinaUtc } from "../format";
import { confirmacionPendiente } from "../lib/comandos";
import {
  datoVigente,
  decimalCanonico,
  DATO_LABEL,
  ESTADO_LABEL,
  FUENTE_LABEL,
  identificacionSeguimiento,
  patenteOperativaValida,
  pesoOperativoValido,
  textoOperativoValido,
} from "../lib/seguimiento";
import { useOperacion } from "../queries/use-logistica";
import { ESTADOS_SEGUIMIENTO, FUENTES_OPERATIVAS } from "../types";
import type {
  AnularSeguimientoBody,
  DatoOperativoBody,
  EstadoSeguimiento,
  EstadoSeguimientoBody,
  FuenteOperativa,
  Seguimiento,
  TipoDatoOperativo,
} from "../types";
import { Campo, FormOperacionFooter } from "./form-operacion";

export type EdicionSeguimiento = "estado" | TipoDatoOperativo | "anular";
const selectClass = "h-9 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink";
export function SeguimientoDialog({
  seguimiento,
  modo,
  onClose,
  onConflict,
}: {
  seguimiento: Seguimiento;
  modo: EdicionSeguimiento;
  onClose: () => void;
  onConflict: () => void;
}) {
  const [snapshot] = useState(() => structuredClone(seguimiento));
  const [estado, setEstado] = useState<EstadoSeguimiento>(snapshot.estadoObservado);
  const head = modo !== "estado" && modo !== "anular" ? datoVigente(snapshot, modo) : undefined;
  const [valor, setValor] = useState(head?.texto ?? String(head?.kilogramos ?? ""));
  const [fuente, setFuente] = useState<FuenteOperativa | "">("");
  const [observado, setObservado] = useState(ahoraArgentinaInput);
  const [referencia, setReferencia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [confirmacionIncierta, setConfirmacionIncierta] = useState(false);
  const intento = useRef<EstadoSeguimientoBody | DatoOperativoBody | AnularSeguimientoBody | null>(
    null,
  );
  const ruta = `seguimientos/${snapshot.cupoId}/${modo === "estado" ? "estado" : modo === "anular" ? "anular" : "datos-operativos"}`;
  const mutation = useOperacion<Seguimiento>(ruta, modo === "estado" ? "put" : "post");
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
  const cerrar = () => {
    if (!protegido) onClose();
  };
  const correccion = modo === "estado" ? snapshot.estadoObservadoAl !== null : !!head;
  const titulo =
    modo === "anular"
      ? "Anular seguimiento"
      : modo === "estado"
        ? correccion
          ? "Corregir estado observado"
          : "Registrar estado observado"
        : `${correccion ? "Corregir" : "Registrar"} ${DATO_LABEL[modo].toLowerCase()}`;
  const enviar = async () => {
    if (mutation.isPending) return;
    if (!intento.current) {
      const instante = instanteArgentinaUtc(observado);
      const motivoRequerido = modo === "anular" || correccion;
      const valido =
        (!motivoRequerido || textoOperativoValido(motivo, 500)) &&
        (modo === "anular" || (!!fuente && !!instante && textoOperativoValido(referencia, 200))) &&
        (modo === "estado" ||
          modo === "anular" ||
          (modo === "patente" ? patenteOperativaValida(valor) : pesoOperativoValido(valor)));
      if (!valido) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      if (modo === "anular")
        intento.current = { revision: snapshot.revision, motivo: motivo.trim() };
      else {
        const comun = {
          revision: snapshot.revision,
          fuente: fuente as FuenteOperativa,
          observadoAl: instante!,
          referencia: referencia.trim(),
          ...(correccion ? { motivoCorreccion: motivo.trim() } : {}),
        };
        intento.current =
          modo === "estado"
            ? { ...comun, estadoObservado: estado }
            : {
                ...comun,
                tipo: modo,
                ...(modo === "patente"
                  ? { texto: valor.trim() }
                  : { kilogramos: decimalCanonico(valor)! }),
                ...(head ? { reemplazaId: head.id } : {}),
              };
      }
    }
    setEnviado(true);
    try {
      await mutation.mutateAsync(intento.current);
      setConfirmacionIncierta(false);
      onClose();
    } catch (error) {
      if (toAppError(error).status === 409) {
        setConfirmacionIncierta(false);
        onConflict();
      } else if (confirmacionPendiente(error)) {
        // Otro rechazo puede ocurrir antes de consultar el replay del primer envío.
        // Conservamos la incertidumbre de este cuerpo/UUID hasta éxito o conflicto.
        setConfirmacionIncierta(true);
      }
    }
  };
  return (
    <Modal open title={titulo} onClose={cerrar}>
      <p className="mb-4 text-sm text-ink-soft">{identificacionSeguimiento(snapshot)}</p>
      {modo === "anular" && (
        <p className="mb-4 text-sm">
          La anulación conserva la asignación, el pedido, los datos registrados y el vínculo con
          MacroGest. El seguimiento quedará disponible sólo para consulta e historial.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void enviar();
        }}
      >
        <fieldset disabled={enviado} className="grid gap-4 sm:grid-cols-2">
          {modo === "estado" && (
            <Campo titulo="Estado observado">
              <select
                className={selectClass}
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoSeguimiento)}
              >
                {ESTADOS_SEGUIMIENTO.map((v) => (
                  <option key={v} value={v}>
                    {ESTADO_LABEL[v]}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          {modo !== "estado" && modo !== "anular" && (
            <div>
              <Campo titulo={DATO_LABEL[modo]}>
                <Input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  required
                  inputMode={modo === "patente" ? "text" : "decimal"}
                  maxLength={modo === "patente" ? 20 : 30}
                />
              </Campo>
              {modo !== "patente" && (
                <p className="mt-1 text-xs text-ink-soft">Kg positivos, hasta 4 decimales.</p>
              )}
            </div>
          )}
          {modo !== "anular" && (
            <>
              <Campo titulo="Fuente de la observación">
                <select
                  className={selectClass}
                  required
                  value={fuente}
                  onChange={(e) => setFuente(e.target.value as FuenteOperativa)}
                >
                  <option value="">Elegir fuente</option>
                  {FUENTES_OPERATIVAS.map((v) => (
                    <option key={v} value={v}>
                      {FUENTE_LABEL[v]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo titulo="Momento observado (hora argentina)">
                <Input
                  type="datetime-local"
                  value={observado}
                  required
                  onChange={(e) => setObservado(e.target.value)}
                />
              </Campo>
              <Campo titulo="Referencia de la observación">
                <Input
                  value={referencia}
                  maxLength={200}
                  required
                  onChange={(e) => setReferencia(e.target.value)}
                />
              </Campo>
            </>
          )}
          {(modo === "anular" || correccion) && (
            <div className="sm:col-span-2">
              <Campo titulo={modo === "anular" ? "Motivo de anulación" : "Motivo de corrección"}>
                <Input
                  value={motivo}
                  maxLength={500}
                  required
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </Campo>
            </div>
          )}
        </fieldset>
        <FormOperacionFooter
          error={mutation.error}
          invalid={invalid}
          pending={mutation.isPending}
          confirmacionIncierta={incierto}
          onClose={cerrar}
          texto={modo === "anular" ? "Anular seguimiento" : "Guardar observación"}
        />
      </form>
      {(incierto || blocker.state === "blocked") && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          Confirmá el resultado antes de salir. Conservamos los datos de esta observación para
          reintentar.
        </p>
      )}
    </Modal>
  );
}
