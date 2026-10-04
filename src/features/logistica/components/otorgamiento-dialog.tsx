import { useCallback } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { Modal } from "@/components/ui/modal";
import { toAppError } from "@/lib/api-error";
import { fecha, kg } from "../format";
import { confirmacionPendiente } from "../lib/comandos";
import { useOperacion } from "../queries/use-logistica";
import type { Cupo, OtorgarBody, OtorgarResultado, Pedido } from "../types";
import { FormOperacionFooter } from "./form-operacion";
import { TablaLogistica } from "./tabla-logistica";

export interface RevisionOtorgamiento {
  body: OtorgarBody;
  cupos: Cupo[];
  pedido: Pedido | null;
  destinatario: string;
  preventa: string;
  advertencias: string[];
}

export function OtorgamientoDialog({
  revision,
  onClose,
  onSuccess,
  onConflict,
}: {
  revision: RevisionOtorgamiento;
  onClose: () => void;
  onSuccess: (resultado: OtorgarResultado) => void;
  onConflict: () => void;
}) {
  const mutation = useOperacion<OtorgarResultado>("otorgamientos");
  const blocker = useBlocker(true);
  useBeforeUnload(
    useCallback((event) => {
      event.preventDefault();
      event.returnValue = "";
    }, []),
  );
  const cerrar = () => {
    if (!mutation.isPending && !confirmacionPendiente(mutation.error)) onClose();
  };
  return (
    <Modal open title="Revisar otorgamiento" onClose={cerrar} className="max-w-6xl">
      <p className="mb-4 text-sm text-ink-soft">
        Revisá el destinatario y las filas antes de confirmar la asignación.
      </p>
      <TablaLogistica
        titulo="Destinatario del otorgamiento"
        filas={[revision]}
        clave={() => "destinatario"}
        columnas={[
          { titulo: "Destinatario", celda: (f) => f.destinatario },
          { titulo: "Preventa", celda: (f) => f.preventa },
          {
            titulo: "Fecha solicitada",
            celda: (f) => (f.pedido ? fecha(f.pedido.fechaSolicitada) : "Sin pedido"),
          },
          {
            titulo: "Cupos pedidos",
            numero: true,
            celda: (f) => f.pedido?.cantidadCupos ?? "Sin pedido",
          },
          {
            titulo: "Ya otorgados",
            numero: true,
            celda: (f) => f.pedido?.otorgados ?? "Sin pedido",
          },
          { titulo: "Cupos seleccionados", numero: true, celda: (f) => f.cupos.length },
          { titulo: "Kg estimados", numero: true, celda: (f) => kg(f.cupos.length * 30000) },
          {
            titulo: "Pendientes del pedido",
            numero: true,
            celda: (f) => f.pedido?.pendientes ?? "Sin pedido",
          },
        ]}
      />
      <p className="my-3 text-xs text-ink-soft">
        Estimación de 30.000 kg por cupo. No representa peso real ni saldo comercial.
      </p>
      <TablaLogistica
        titulo="Cupos a otorgar"
        filas={revision.cupos}
        clave={(f) => f.id}
        columnas={[
          { titulo: "Contrato", celda: (f) => f.contratoVenta },
          { titulo: "Código terminal", celda: (f) => f.codigoTerminal || "Pendiente de informar" },
          { titulo: "Destino", celda: (f) => f.destinoNombre ?? f.destinoCodigo },
          { titulo: "Fecha de carga", celda: (f) => fecha(f.fechaCarga) },
          {
            titulo: "Cereal / campaña",
            celda: (f) => `${f.productoNombre ?? f.producto} / ${f.campania}`,
          },
          { titulo: "Circuito", celda: (f) => f.circuito },
          { titulo: "Seguimiento", celda: (f) => f.estadoObservado.replaceAll("_", " ") },
        ]}
      />
      {revision.advertencias.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {revision.advertencias.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (mutation.isPending) return;
          try {
            onSuccess(await mutation.mutateAsync(revision.body));
          } catch (error) {
            if (toAppError(error).status === 409) onConflict();
          }
        }}
      >
        <FormOperacionFooter
          error={mutation.error}
          pending={mutation.isPending}
          onClose={cerrar}
          texto="Confirmar otorgamiento"
        />
      </form>
      {blocker.state === "blocked" && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          {mutation.isPending || confirmacionPendiente(mutation.error)
            ? "Confirmá el resultado del otorgamiento antes de salir de esta página."
            : "Cerrá la revisión para salir de esta página."}
        </p>
      )}
      {confirmacionPendiente(mutation.error) && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          La confirmación está pendiente. Conservamos esta selección para consultar el resultado al
          reintentar.
        </p>
      )}
    </Modal>
  );
}
