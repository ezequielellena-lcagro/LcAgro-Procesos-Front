import { confirmacionPendiente } from "../lib/comandos";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { ahoraLocal } from "../format";
import { useOperacion } from "../queries/use-logistica";
import type { Solicitud } from "../types";
import { Campo, FormOperacionFooter } from "./form-operacion";
export function RespuestaDialog({
  solicitud,
  cerrarSolicitud = false,
  onClose,
}: {
  solicitud: Solicitud;
  cerrarSolicitud?: boolean;
  onClose: () => void;
}) {
  const mutation = useOperacion<Solicitud>(
    `solicitudes-terminal/${solicitud.id}/${cerrarSolicitud ? "cerrar" : "respuestas"}`,
  );
  const form = useForm<{
    cantidadCupos: number;
    observadoAl: string;
    referencia: string;
    motivo: string;
    observacion: string;
  }>({
    defaultValues: {
      cantidadCupos: 0,
      observadoAl: ahoraLocal(),
      referencia: "",
      motivo: "",
      observacion: "",
    },
  });
  const cerrar = () => {
    if (!mutation.isPending && !confirmacionPendiente(mutation.error)) onClose();
  };
  return (
    <Modal
      open
      title={cerrarSolicitud ? "Cerrar solicitud" : "Registrar respuesta de terminal"}
      onClose={cerrar}
    >
      <p className="mb-4 text-sm">
        Contrato {solicitud.contratoVenta} · {solicitud.cantidadCupos} cupos solicitados.{" "}
        {cerrarSolicitud
          ? "Las recepciones tardías seguirán disponibles."
          : "Cero es una respuesta válida. Cada mensaje queda en el historial."}
      </p>
      <form
        onSubmit={form.handleSubmit(async (v) => {
          try {
            await mutation.mutateAsync(
              cerrarSolicitud
                ? { revision: solicitud.revision, motivo: v.motivo }
                : {
                    revision: solicitud.revision,
                    cantidadCupos: v.cantidadCupos,
                    observadoAl: new Date(v.observadoAl).toISOString(),
                    referencia: v.referencia,
                    observacion: v.observacion || null,
                  },
            );
            onClose();
          } catch {
            /* Error visible. */
          }
        })}
      >
        <fieldset
          disabled={mutation.isPending || confirmacionPendiente(mutation.error)}
          className="space-y-4"
        >
          {cerrarSolicitud ? (
            <Campo titulo="Motivo de cierre">
              <Textarea
                maxLength={500}
                {...form.register("motivo", {
                  required: true,
                  maxLength: 500,
                  validate: (s) => s.trim().length > 0,
                })}
              />
            </Campo>
          ) : (
            <>
              <Campo titulo="Cupos comunicados en esta respuesta">
                <Input
                  type="number"
                  min={0}
                  max={100000}
                  {...form.register("cantidadCupos", {
                    required: true,
                    valueAsNumber: true,
                    min: 0,
                    max: 100000,
                  })}
                />
              </Campo>
              <Campo titulo="Fecha y hora de la respuesta">
                <Input
                  type="datetime-local"
                  {...form.register("observadoAl", { required: true })}
                />
              </Campo>
              <Campo titulo="Referencia del mensaje">
                <Input
                  maxLength={200}
                  {...form.register("referencia", {
                    required: true,
                    maxLength: 200,
                    validate: (s) => s.trim().length > 0,
                  })}
                />
              </Campo>
              <Campo titulo="Observación (opcional)">
                <Textarea maxLength={500} {...form.register("observacion")} />
              </Campo>
            </>
          )}
        </fieldset>
        <FormOperacionFooter
          error={mutation.error}
          invalid={Object.keys(form.formState.errors).length > 0}
          pending={mutation.isPending}
          onClose={cerrar}
          texto={cerrarSolicitud ? "Cerrar solicitud" : "Guardar respuesta"}
        />
      </form>
    </Modal>
  );
}
