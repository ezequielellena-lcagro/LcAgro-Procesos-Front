import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { columnasCamion } from "../lib/flota-seguimiento";
import { textoFlotaValido, trimFlota } from "../lib/flota";
import { identificacionSeguimiento } from "../lib/seguimiento";
import {
  useConfirmacionFlota,
  useRetirarFlotaSeguimiento,
} from "../queries/use-logistica-flota-seguimiento";
import type { RetirarFlotaSeguimientoBody, Seguimiento } from "../types";
import { Campo, FormOperacionFooter } from "./form-operacion";
import { TablaLogistica } from "./tabla-logistica";

export function RetirarFlotaSeguimientoDialog({
  seguimiento,
  onClose,
  onConflict,
}: {
  seguimiento: Seguimiento;
  onClose: () => void;
  onConflict: () => void;
}) {
  const [snapshot] = useState(() => structuredClone(seguimiento));
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const mutation = useRetirarFlotaSeguimiento(snapshot.cupoId);
  const intento = useConfirmacionFlota(mutation, onClose, onConflict);
  const enviar = async () => {
    if (
      !intento.enviado &&
      (!snapshot.flotaVigente ||
        snapshot.anuladoAl ||
        !textoFlotaValido(motivo, 500) ||
        !confirmado)
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const body: RetirarFlotaSeguimientoBody = {
      revision: snapshot.revision,
      motivo: trimFlota(motivo),
    };
    await intento.enviar(body);
  };
  return (
    <Modal open title="Retirar camión" onClose={intento.cerrar} className="max-w-7xl">
      <p className="mb-3 text-sm text-ink-soft">{identificacionSeguimiento(snapshot)}</p>
      <p className="mb-4 text-sm">Revisá el camión elegido y registrá el motivo del retiro.</p>
      <TablaLogistica
        titulo="Camión elegido a retirar"
        filas={snapshot.flotaVigente ? [snapshot.flotaVigente] : []}
        clave={(f) => f.versionId}
        columnas={columnasCamion()}
        vacio="Sin camión elegido"
      />
      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          void enviar();
        }}
      >
        <fieldset disabled={intento.enviado} className="space-y-4">
          <Campo titulo="Motivo del retiro">
            <Input value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
          </Campo>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
            Confirmo el retiro del camión elegido
          </label>
        </fieldset>
        <FormOperacionFooter
          error={mutation.error}
          invalid={invalid}
          pending={mutation.isPending}
          confirmacionIncierta={intento.incierto}
          onClose={intento.cerrar}
          texto="Retirar camión"
        />
      </form>
      {(intento.incierto || intento.bloqueada) && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          Confirmá el resultado antes de salir. Conservamos el motivo y la revisión de este intento
          para reintentar.
        </p>
      )}
    </Modal>
  );
}
