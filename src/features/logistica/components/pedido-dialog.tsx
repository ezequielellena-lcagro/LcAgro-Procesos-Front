import { confirmacionPendiente } from "../lib/comandos";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { hoy, campania, fecha, kg } from "../format";
import { useDetalle, useOperacion } from "../queries/use-logistica";
import type { Pedido, Preventa } from "../types";
import { CatalogoSelect } from "./catalogo-select";
import { PreventaPicker } from "./contrato-picker";
import { Campo, FormOperacionFooter } from "./form-operacion";
import { TablaLogistica } from "./tabla-logistica";
const schema = z.object({
  clienteNumero: z.number().int().min(1).max(9999999999),
  producto: z.number().int().min(1).max(999999),
  campania: z
    .string()
    .regex(/^\d{4}-\d{4}$/)
    .refine((s) => Number(s.slice(5)) === Number(s.slice(0, 4)) + 1),
  fechaSolicitada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cantidadCupos: z.number().int().min(1).max(100000),
  observacion: z.string().max(120),
});
type Valores = z.infer<typeof schema>;
export function PedidoDialog({
  pedido,
  preventaInicial,
  onClose,
}: {
  pedido?: Pedido;
  preventaInicial?: Preventa;
  onClose: () => void;
}) {
  const [modo, setModo] = useState<"preventa" | "libre">(
    pedido && !pedido.preventa ? "libre" : "preventa",
  );
  const [elegida, setElegida] = useState<Preventa | null>(preventaInicial ?? null);
  const previa = useDetalle<Preventa>(
    "preventas/detalle",
    pedido?.preventa ?? {},
    !!pedido?.preventa,
  );
  const seleccion = elegida ?? previa.data ?? null;
  const mutation = useOperacion<Pedido>(
    pedido ? `pedidos/${pedido.id}` : "pedidos",
    pedido ? "put" : "post",
  );
  const form = useForm<Valores>({
    resolver: zodResolver(schema),
    defaultValues: {
      clienteNumero: pedido?.clienteNumero ?? preventaInicial?.clienteNumero ?? 0,
      producto: pedido?.producto ?? preventaInicial?.producto ?? 0,
      campania: pedido?.campania ?? (preventaInicial ? campania(preventaInicial.campania) : ""),
      fechaSolicitada: pedido?.fechaSolicitada ?? hoy(),
      cantidadCupos: pedido?.cantidadCupos ?? 1,
      observacion: pedido?.observacion ?? "",
    },
  });
  const valores = useWatch({ control: form.control });
  const cerrar = () => {
    if (!mutation.isPending && !confirmacionPendiente(mutation.error)) onClose();
  };
  const elegir = (p: Preventa) => {
    setElegida(p);
    form.setValue("clienteNumero", p.clienteNumero ?? 0);
    form.setValue("producto", p.producto ?? 0);
    form.setValue("campania", campania(p.campania));
  };
  const enviar = form.handleSubmit(async (v) => {
    if (modo === "preventa" && !seleccion) {
      form.setError("root", { message: "Elegí una preventa." });
      return;
    }
    try {
      await mutation.mutateAsync({
        ...v,
        preventa:
          modo === "preventa" && seleccion
            ? { operacion: seleccion.operacion, numero: seleccion.numero }
            : null,
        observacion: v.observacion || null,
        ...(pedido ? { revision: pedido.revision } : {}),
      });
      onClose();
    } catch {
      /* El error se muestra con el mismo comando disponible para reintento. */
    }
  });
  return (
    <Modal
      open
      title={pedido ? "Corregir pedido" : "Nuevo pedido"}
      onClose={cerrar}
      className="max-w-5xl"
    >
      <p className="mb-4 text-sm text-ink-soft">
        Registrá la demanda del productor. El pedido no crea un cupo.
      </p>
      <fieldset
        disabled={mutation.isPending || confirmacionPendiente(mutation.error)}
        className="mb-4 flex gap-5"
      >
        <label>
          <input
            type="radio"
            name="modalidad"
            checked={modo === "preventa"}
            onChange={() => setModo("preventa")}
          />{" "}
          Contra una preventa
        </label>
        <label>
          <input
            type="radio"
            name="modalidad"
            checked={modo === "libre"}
            onChange={() => setModo("libre")}
          />{" "}
          Sin preventa
        </label>
      </fieldset>
      {modo === "preventa" && (
        <fieldset disabled={mutation.isPending || confirmacionPendiente(mutation.error)}>
          <PreventaPicker selected={seleccion} onSelect={elegir} />
          {seleccion && (
            <div className="my-4">
              <TablaLogistica
                titulo="Preventa seleccionada"
                filas={[seleccion]}
                clave={(p) => p.numero}
                columnas={[
                  { titulo: "Preventa", celda: (p) => `${p.operacion} ${p.numero}` },
                  {
                    titulo: "Productor",
                    celda: (p) => p.clienteNombre ?? `Cliente ${p.clienteNumero}`,
                  },
                  { titulo: "Cereal", celda: (p) => p.productoNombre ?? p.producto },
                  { titulo: "Campaña", celda: (p) => campania(p.campania) },
                  { titulo: "Contratado", numero: true, celda: (p) => kg(p.kgContratados) },
                  {
                    titulo: "Entrega",
                    celda: (p) => `${fecha(p.fechaEntregaInicio)} — ${fecha(p.fechaEntregaFin)}`,
                  },
                ]}
              />
              <p className="mt-2 text-xs text-ink-soft">
                MacroGest · El saldo anterior al inicio de Logística queda pendiente de
                verificación.
              </p>
            </div>
          )}
        </fieldset>
      )}
      <form onSubmit={enviar} className="mt-4">
        <fieldset
          disabled={mutation.isPending || confirmacionPendiente(mutation.error)}
          className="grid gap-4 sm:grid-cols-3"
        >
          {modo === "libre" && (
            <>
              <CatalogoSelect
                tipo="clientes"
                titulo="Productor"
                value={valores.clienteNumero ?? 0}
                onChange={(v) => form.setValue("clienteNumero", v, { shouldValidate: true })}
              />
              <CatalogoSelect
                tipo="productos"
                titulo="Cereal"
                value={valores.producto ?? 0}
                onChange={(v) => form.setValue("producto", v, { shouldValidate: true })}
              />
              <Campo titulo="Campaña">
                <Input placeholder="2025-2026" {...form.register("campania")} />
              </Campo>
            </>
          )}
          <Campo titulo="Cupos que pide">
            <Input
              type="number"
              min={1}
              max={100000}
              {...form.register("cantidadCupos", { valueAsNumber: true })}
            />
          </Campo>
          <Campo titulo="Para cuándo">
            <Input type="date" {...form.register("fechaSolicitada")} />
          </Campo>
          <Campo titulo="Estimación por cupo">
            <Input value="30.000 kg" disabled />
          </Campo>
          <div className="sm:col-span-3">
            <Campo titulo="Observación (opcional)">
              <Textarea maxLength={120} {...form.register("observacion")} />
            </Campo>
          </div>
        </fieldset>
        <FormOperacionFooter
          error={mutation.error}
          invalid={Object.keys(form.formState.errors).length > 0}
          pending={mutation.isPending}
          onClose={cerrar}
          texto={pedido ? "Guardar corrección" : "Guardar pedido"}
        />
      </form>
    </Modal>
  );
}
