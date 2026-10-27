import { confirmacionPendiente } from "../lib/comandos";
import { useForm } from "react-hook-form";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useOperacion } from "../queries/use-logistica";
import type { Solicitud } from "../types";
import { Campo, FormOperacionFooter } from "./form-operacion";

/**
 * Cerrar un pedido de cupo a la terminal: ya no se espera más de lo que se pidió. Ya no hay
 * respuesta manual: lo conseguido se cuenta solo con los cupos que entraron a MacroGest.
 */
export function CerrarSolicitudDialog({
  solicitud,
  onClose,
}: {
  solicitud: Solicitud;
  onClose: () => void;
}) {
  const mutation = useOperacion<Solicitud>(`solicitudes-terminal/${solicitud.id}/cerrar`);
  const form = useForm<{ motivo: string }>({ defaultValues: { motivo: "" } });
  const cerrar = () => {
    if (!mutation.isPending && !confirmacionPendiente(mutation.error)) onClose();
  };
  return (
    <Modal open title="Cerrar pedido de cupo" onClose={cerrar}>
      <p className="mb-4 text-sm">
        Contrato {solicitud.contratoVenta} · {solicitud.cantidadCupos} cupos pedidos. Los cupos que
        entren después a MacroGest se siguen contando.
      </p>
      <form
        onSubmit={form.handleSubmit(async (v) => {
          try {
            await mutation.mutateAsync({ revision: solicitud.revision, motivo: v.motivo });
            onClose();
          } catch {
            /* Error visible. */
          }
        })}
      >
        <fieldset disabled={mutation.isPending || confirmacionPendiente(mutation.error)}>
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
        </fieldset>
        <FormOperacionFooter
          error={mutation.error}
          invalid={Object.keys(form.formState.errors).length > 0}
          pending={mutation.isPending}
          onClose={cerrar}
          texto="Cerrar pedido de cupo"
        />
      </form>
    </Modal>
  );
}
