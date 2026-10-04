import { confirmacionPendiente } from "../lib/comandos";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { hoy, campania, ahoraLocal } from "../format";
import { useOperacion } from "../queries/use-logistica";
import type { Solicitud, Venta } from "../types";
import { CatalogoSelect } from "./catalogo-select";
import { VentaPicker } from "./contrato-picker";
import { Campo, FormOperacionFooter } from "./form-operacion";
interface Valores {
  destinoCodigo: number;
  fechaSolicitada: string;
  cantidadCupos: number;
  canal: string;
  observacion: string;
}
export function SolicitudDialog({ onClose }: { onClose: () => void }) {
  const [venta, setVenta] = useState<Venta | null>(null);
  const [destino, setDestino] = useState(0);
  const mutation = useOperacion<Solicitud>("solicitudes-terminal");
  const form = useForm<Valores>({
    defaultValues: {
      destinoCodigo: 0,
      fechaSolicitada: hoy(),
      cantidadCupos: 1,
      canal: "correo",
      observacion: "",
    },
  });
  const cerrar = () => {
    if (!mutation.isPending && !confirmacionPendiente(mutation.error)) onClose();
  };
  return (
    <Modal open title="Solicitar cupos a terminal" onClose={cerrar} className="max-w-5xl">
      <fieldset disabled={mutation.isPending || confirmacionPendiente(mutation.error)}>
        <VentaPicker
          selected={venta}
          onSelect={(v) => {
            setVenta(v);
            setDestino(v.destinoCodigo ?? 0);
          }}
        />
      </fieldset>
      {venta && (
        <p className="my-4 text-sm">
          Contrato {venta.numero} · Cereal {venta.producto} · Campaña {campania(venta.campania)}
        </p>
      )}
      <form
        onSubmit={form.handleSubmit(async (values) => {
          if (!venta || !destino) {
            form.setError("root", { message: "Elegí contrato y destino." });
            return;
          }
          try {
            await mutation.mutateAsync({
              ...values,
              contratoVenta: venta.numero,
              destinoCodigo: destino,
              observacion: values.observacion || null,
            });
            onClose();
          } catch {
            /* Error visible. */
          }
        })}
      >
        <fieldset
          disabled={mutation.isPending || confirmacionPendiente(mutation.error)}
          className="mt-4 grid gap-4 sm:grid-cols-3"
        >
          <CatalogoSelect
            tipo="destinos"
            titulo="Destino solicitado"
            value={destino}
            onChange={setDestino}
          />
          <Campo titulo="Fecha solicitada">
            <Input type="date" {...form.register("fechaSolicitada", { required: true })} />
          </Campo>
          <Campo titulo="Cantidad de cupos">
            <Input
              type="number"
              min={1}
              max={100000}
              {...form.register("cantidadCupos", {
                valueAsNumber: true,
                required: true,
                min: 1,
                max: 100000,
              })}
            />
          </Campo>
          <Campo titulo="Canal">
            <Input maxLength={30} {...form.register("canal", { required: true, maxLength: 30 })} />
          </Campo>
          <div className="sm:col-span-2">
            <Campo titulo="Observación (opcional)">
              <Textarea maxLength={500} {...form.register("observacion")} />
            </Campo>
          </div>
        </fieldset>
        <FormOperacionFooter
          error={mutation.error}
          invalid={Object.keys(form.formState.errors).length > 0}
          pending={mutation.isPending}
          onClose={cerrar}
          texto="Guardar solicitud"
        />
      </form>
    </Modal>
  );
}
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
