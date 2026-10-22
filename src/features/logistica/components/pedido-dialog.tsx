import { confirmacionPendiente } from "../lib/comandos";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { hoy, campania } from "../format";
import { useDetalle, useOperacion } from "../queries/use-logistica";
import type { Pedido, Preventa } from "../types";
import { CatalogoSelect } from "./catalogo-select";
import { PreventaPicker } from "./contrato-picker";
import { Campo, FormOperacionFooter } from "./form-operacion";
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
  // `undefined` = nadie tocó el picker (vale la preventa que ya tiene el pedido); `null` = se
  // soltó a propósito, y entonces no debe volver la anterior.
  const [elegida, setElegida] = useState<Preventa | null | undefined>(preventaInicial);
  const previa = useDetalle<Preventa>(
    "preventas/detalle",
    pedido?.preventa ?? {},
    !!pedido?.preventa,
  );
  const seleccion = elegida !== undefined ? elegida : (previa.data ?? null);
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
  const elegir = (p: Preventa | null) => {
    setElegida(p);
    form.clearErrors("root");
    if (!p) return; // soltarla no borra lo cargado: puede pasarse a "sin preventa" y seguir
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
  const formId = useId();
  // El bloque de datos viaja: contra una preventa se monta ENTRE los filtros y la tabla del picker,
  // así no hay que cruzar la grilla de preventas para cargar cupos y fecha. Ahí queda fuera del
  // <form>, y por eso cada campo declara `form={formId}`: sin eso se pierde el envío con Enter.
  const datos = (
    <fieldset
      disabled={mutation.isPending || confirmacionPendiente(mutation.error)}
      className="mb-5"
    >
      <Seccion titulo="Datos del pedido" />
      <div className="grid gap-4 sm:grid-cols-3">
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
              <Input placeholder="2025-2026" form={formId} {...form.register("campania")} />
            </Campo>
          </>
        )}
        <Campo titulo="Cupos que pide">
          <Input
            type="number"
            min={1}
            max={100000}
            form={formId}
            {...form.register("cantidadCupos", { valueAsNumber: true })}
          />
        </Campo>
        <Campo titulo="Para cuándo">
          <Input type="date" form={formId} {...form.register("fechaSolicitada")} />
        </Campo>
        <Campo titulo="Estimación por cupo">
          <Input value="30.000 kg" disabled />
        </Campo>
        <div className="sm:col-span-3">
          <Campo titulo="Observación (opcional)">
            <Textarea maxLength={120} form={formId} {...form.register("observacion")} />
          </Campo>
        </div>
      </div>
      {/* Acá iba una tabla de una fila con la preventa elegida, y después una línea de texto con lo
          mismo. Las dos repetían lo que ya dice el casillero marcado en la grilla de abajo. */}
    </fieldset>
  );
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
        className="mb-5"
      >
        <legend className="mb-1.5 text-xs font-medium text-ink-soft">Modalidad</legend>
        <div className="flex flex-wrap gap-2">
          <Modalidad
            titulo="Contra una preventa"
            checked={modo === "preventa"}
            onChange={() => setModo("preventa")}
          />
          <Modalidad
            titulo="Sin preventa"
            checked={modo === "libre"}
            onChange={() => setModo("libre")}
          />
        </div>
      </fieldset>
      {modo === "preventa" && (
        <fieldset disabled={mutation.isPending || confirmacionPendiente(mutation.error)}>
          <Seccion titulo="Preventa de referencia" />
          <PreventaPicker
            selected={seleccion}
            onSelect={elegir}
            busquedaInicial={preventaInicial?.numero ?? pedido?.preventa?.numero ?? ""}
            bajoFiltros={datos}
            tamano={10}
          />
        </fieldset>
      )}
      <form id={formId} onSubmit={enviar} className="mt-5">
        {modo === "libre" && datos}
        {/* `setError("root")` no lo mostraba nadie: el pie sólo decía "completá los campos
            obligatorios" y el motivo real —que falta elegir la preventa— se perdía. */}
        {form.formState.errors.root?.message && (
          <p role="alert" className="mb-3 text-sm text-rojo">
            {form.formState.errors.root.message}
          </p>
        )}
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

/**
 * Una opción de modalidad. Es un radio de verdad (navegable con flechas, anunciado como grupo)
 * vestido de tarjeta: dos radios desnudos con el texto al lado no se leían como una elección
 * entre dos caminos distintos del formulario.
 */
function Modalidad({
  titulo,
  checked,
  onChange,
}: {
  titulo: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-panel px-3 py-2 text-sm transition-colors hover:bg-secondary has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:font-semibold has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
      <input
        type="radio"
        name="modalidad"
        className="size-4 accent-primary"
        checked={checked}
        onChange={onChange}
      />
      {titulo}
    </label>
  );
}

/** Corte entre bloques del diálogo: el modal junta tres cosas distintas en una sola columna. */
function Seccion({ titulo }: { titulo: string }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{titulo}</h3>
  );
}
