import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/shared/components/page-header";
import { AvisoDemo } from "../components/aviso-demo";
import { VentaPicker } from "../components/contrato-picker";
import { Campo, FormOperacionFooter } from "../components/form-operacion";
import { campania, hoy } from "../format";
import { confirmacionPendiente } from "../lib/comandos";
import { useOperacion } from "../queries/use-logistica";
import type { Solicitud, Venta } from "../types";

interface Valores {
  fechaSolicitada: string;
  cantidadCupos: number;
  canal: string;
  observacion: string;
}

/** Filas por página de la grilla de contratos: de a diez entra entera arriba del formulario. */
const TRAMO_CONTRATOS = 10;

/**
 * Solicitar cupos a terminal, como pantalla propia y no como modal.
 *
 * La pantalla se lee en el orden en que se trabaja: arriba la grilla de contratos —paginada de a
 * diez, así entra completa— y abajo los datos de la solicitud. El contrato elegido no se repite en
 * un panel de cabecera: la fila queda remarcada en la grilla y el formulario lo nombra en su
 * primera línea. Volver a tocar el casillero suelta la elección.
 */
export function SolicitarCuposPage() {
  const navigate = useNavigate();
  const [venta, setVenta] = useState<Venta | null>(null);
  const mutation = useOperacion<Solicitud>("solicitudes-terminal");
  const bloqueado = mutation.isPending || confirmacionPendiente(mutation.error);
  const form = useForm<Valores>({
    // El canal arranca en WhatsApp: es por donde se piden hoy (devolución del 2026-10-23).
    defaultValues: { fechaSolicitada: hoy(), cantidadCupos: 1, canal: "WhatsApp", observacion: "" },
  });
  const volver = () => {
    if (!bloqueado) void navigate("/logistica/cupos", { state: { tab: "historial" } });
  };
  return (
    <>
      <PageHeader
        title="Solicitar cupos a terminal"
        subtitle="Qué cupos le pediste a la terminal y sobre qué contrato de venta. Los conseguidos se cuentan solos con los cupos que recibís en la app."
        actions={
          <Button variant="outline" type="button" disabled={bloqueado} onClick={volver}>
            <ArrowLeft className="size-4" aria-hidden /> Volver a Cupos
          </Button>
        }
      />
      <AvisoDemo />

      <fieldset disabled={bloqueado} className="min-w-0">
        <VentaPicker
          selected={venta}
          tamano={TRAMO_CONTRATOS}
          onSelect={(v) => {
            setVenta(v);
            form.clearErrors("root");
          }}
          onSoltar={() => setVenta(null)}
        />
      </fieldset>

      <form
        className="mt-6"
        onSubmit={form.handleSubmit(async (values) => {
          if (!venta) {
            form.setError("root", {
              message: "Elegí un contrato de venta en la grilla de arriba.",
            });
            return;
          }
          try {
            await mutation.mutateAsync({
              ...values,
              contratoVenta: venta.numero,
              observacion: values.observacion || null,
            });
            // Vuelve a la solapa donde quedó la solicitud recién creada, no a la de entrada.
            void navigate("/logistica/cupos", { state: { tab: "historial" } });
          } catch {
            /* El error se muestra en el pie, con la misma clave disponible para reintentar. */
          }
        })}
      >
        <fieldset
          disabled={bloqueado || !venta}
          className="rounded-card border border-line bg-panel p-4 shadow-card"
        >
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Datos de la solicitud
          </legend>
          {/* Sobre qué contrato se está pidiendo, en una línea: el panel de cabecera repetía la
              fila que ya queda remarcada en la grilla, y acá el dato se lee donde se completa. */}
          <p className="mb-3 text-sm text-ink-soft">
            {venta
              ? `Contrato ${venta.numero} · ${venta.compradorNombre ?? "Sin nombre"} · ${
                  venta.productoNombre ?? venta.producto ?? "Sin cereal"
                } / ${campania(venta.campania)}`
              : "Elegí un contrato de venta en la grilla de arriba y marcá su casillero."}
          </p>
          {/* Sin destino: a la terminal se le dice el contrato y manda el cupo según dónde tenga
              lugar. Quedan fecha, cantidad y canal en una fila; la observación, entera abajo. */}
          <div className="grid gap-4 sm:grid-cols-3">
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
              <Input
                maxLength={30}
                {...form.register("canal", { required: true, maxLength: 30 })}
              />
            </Campo>
            <div className="sm:col-span-3">
              <Campo titulo="Observación (opcional)">
                <Textarea maxLength={500} {...form.register("observacion")} />
              </Campo>
            </div>
          </div>
        </fieldset>
        {form.formState.errors.root?.message && (
          <p role="alert" className="mt-3 text-sm text-rojo">
            {form.formState.errors.root.message}
          </p>
        )}
        <FormOperacionFooter
          error={mutation.error}
          invalid={Object.keys(form.formState.errors).some((c) => c !== "root")}
          pending={mutation.isPending}
          onClose={volver}
          texto="Guardar solicitud"
        />
      </form>
    </>
  );
}
