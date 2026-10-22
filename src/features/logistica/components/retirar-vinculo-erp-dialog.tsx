import { useCallback, useRef, useState } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { toAppError } from "@/lib/api-error";
import { confirmacionPendiente } from "../lib/comandos";
import { identificacionSeguimiento, textoOperativoValido } from "../lib/seguimiento";
import { useOperacion } from "../queries/use-logistica";
import type { RetirarVinculoErpBody, RetiroVinculoErpResultado, Seguimiento } from "../types";
import { Campo, FormOperacionFooter } from "./form-operacion";
import { TablaLogistica } from "./tabla-logistica";

export function RetirarVinculoErpDialog({
  seguimiento,
  onClose,
  onConflict,
}: {
  seguimiento: Seguimiento;
  onClose: () => void;
  onConflict: () => void;
}) {
  const [snapshot] = useState(() => structuredClone(seguimiento));
  const [evidencia, setEvidencia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [confirmacionIncierta, setConfirmacionIncierta] = useState(false);
  const intento = useRef<RetirarVinculoErpBody | null>(null);
  const mutation = useOperacion<RetiroVinculoErpResultado>(
    `cupos/${snapshot.cupoId}/vinculo-erp/retirar`,
  );
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
  const enviar = async () => {
    if (mutation.isPending) return;
    if (!intento.current) {
      if (
        !snapshot.vinculoErpVigente ||
        !textoOperativoValido(evidencia, 500) ||
        !textoOperativoValido(motivo, 500) ||
        !confirmado
      ) {
        setInvalid(true);
        return;
      }
      intento.current = structuredClone({
        revision: snapshot.cupo.revision,
        vinculoActualId: snapshot.vinculoErpVigente.id,
        evidencia: evidencia.trim(),
        motivo: motivo.trim(),
        confirmado: true,
      });
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
  return (
    <Modal open title="Retirar referencia" onClose={cerrar} className="max-w-4xl">
      <p className="mb-3 text-sm text-ink-soft">{identificacionSeguimiento(snapshot)}</p>
      <p className="mb-4 text-sm">
        Esta corrección conserva el otorgamiento y el viaje, con sus datos operativos. Retira la
        referencia de nuestra operación; no declara una baja administrativa en MacroGest.
      </p>
      <TablaLogistica
        titulo="Referencia vigente a retirar"
        filas={snapshot.vinculoErpVigente ? [snapshot.vinculoErpVigente] : []}
        clave={(f) => f.id}
        columnas={[
          { titulo: "ID del vínculo", celda: (f) => f.id },
          { titulo: "Contrato", celda: (f) => f.contrato },
          { titulo: "Plan de carga", numero: true, celda: (f) => f.grupo },
          { titulo: "Cupo", numero: true, celda: (f) => f.cupo },
        ]}
      />
      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          void enviar();
        }}
      >
        <fieldset disabled={enviado} className="space-y-4">
          <Campo titulo="Evidencia de la corrección">
            <Input
              value={evidencia}
              maxLength={500}
              onChange={(e) => setEvidencia(e.target.value)}
            />
          </Campo>
          <Campo titulo="Motivo de la corrección">
            <Input value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
          </Campo>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
            Confirmo retirar esta referencia y conservar el otorgamiento y el viaje
          </label>
        </fieldset>
        <FormOperacionFooter
          error={mutation.error}
          invalid={invalid}
          pending={mutation.isPending}
          confirmacionIncierta={incierto}
          onClose={cerrar}
          texto="Retirar referencia"
        />
      </form>
      {(incierto || blocker.state === "blocked") && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          Confirmá el resultado antes de salir. Conservamos la referencia, la evidencia, el motivo y
          la revisión de este intento para reintentar.
        </p>
      )}
    </Modal>
  );
}
