import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { toAppError } from "@/lib/api-error";
import { unidades } from "../format";
import { normalizarComprobante } from "../lib/comprobante";
import {
  MOTIVOS_ANULACION,
  type AnularOrdenInput,
  type DespacharOrdenInput,
  type MotivoAnulacionOrdenCarga,
  type OrdenCargaDto,
} from "../types";
import { MotivoSelect } from "./motivo-select";

export type TipoTransicionOrden = "despachar" | "anular";

export interface Transicion {
  tipo: TipoTransicionOrden;
  orden: OrdenCargaDto;
}

const campos = z.object({
  numeroRemito: z.string(),
  numeroPedidoVenta: z.string(),
  motivo: z.string(),
  detalle: z.string(),
});
type Values = z.infer<typeof campos>;

/**
 * El remito es obligatorio y con formato `NN-NNNNN` sólo al despachar (R6.2/R6.4); el pedido, si se
 * completa acá, respeta el mismo formato pero es opcional. Anular exige un motivo de la lista
 * cerrada, con detalle obligatorio si es "Otro" (R1.5/R6.5) — la misma regla que `MotivoSelect` ya
 * aplica visualmente al mostrar el textarea.
 */
function esquema(tipo: TipoTransicionOrden) {
  return campos.superRefine((v, ctx) => {
    if (tipo === "despachar") {
      if (normalizarComprobante(v.numeroRemito) === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El remito es obligatorio y tiene que tener el formato NN-NNNNN.",
          path: ["numeroRemito"],
        });
      }
      if (v.numeroPedidoVenta.trim() !== "" && normalizarComprobante(v.numeroPedidoVenta) === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El pedido tiene que tener el formato NN-NNNNN.",
          path: ["numeroPedidoVenta"],
        });
      }
      return;
    }
    if (v.motivo === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Elegí el motivo de la anulación.", path: ["motivo"] });
    } else if (v.motivo === "Otro" && v.detalle.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Escribí el detalle cuando el motivo es "Otro".',
        path: ["detalle"],
      });
    }
  });
}

const TITULOS: Record<TipoTransicionOrden, (numero: number) => string> = {
  despachar: (numero) => `Despachar orden N° ${numero}`,
  anular: (numero) => `Anular orden N° ${numero}`,
};

interface Props {
  transicion: Transicion | null;
  onDespachar: (id: number, input: DespacharOrdenInput) => Promise<unknown>;
  onAnular: (id: number, input: AnularOrdenInput) => Promise<unknown>;
  /**
   * Ante un 409 (físico insuficiente al despachar, u orden que dejó de estar Pendiente por una
   * operación concurrente, R6.4/R6.7), el disponible que ve el resto de la pantalla puede haber
   * quedado desactualizado: se llama para refrescar el stock aunque la propia operación haya
   * fallado (el éxito ya invalida todo el módulo por su cuenta).
   */
  onErrorRefrescarStock: () => void;
  onClose: () => void;
}

/**
 * Despacho (R6.4) y anulación (R6.5) de una orden Pendiente. Comparten diálogo porque las dos son
 * transiciones acotadas de un único paso, a diferencia de `OrdenDialog` (alta/edición), que necesita
 * clientes/destinos/lotes del resto de la pantalla — acá alcanza con la propia orden.
 */
export function TransicionOrdenDialog({ transicion, onClose, ...resto }: Props) {
  const abierto = transicion !== null;
  return (
    <Modal open={abierto} onClose={onClose} title={abierto ? TITULOS[transicion.tipo](transicion.orden.numero) : ""}>
      {abierto && (
        <TransicionForm
          key={`${transicion.tipo}-${transicion.orden.id}`}
          transicion={transicion}
          onClose={onClose}
          {...resto}
        />
      )}
    </Modal>
  );
}

function TransicionForm({
  transicion,
  onDespachar,
  onAnular,
  onErrorRefrescarStock,
  onClose,
}: Omit<Props, "transicion"> & { transicion: Transicion }) {
  const { tipo, orden } = transicion;
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(esquema(tipo)),
    defaultValues: {
      numeroRemito: "",
      numeroPedidoVenta: orden.numeroPedidoVenta ?? "",
      motivo: "",
      detalle: "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  // `useWatch`, no `form.watch()`: hace falta releer "detalle" en cada tecla para que el textarea
  // de `MotivoSelect` no quede viejo (mismo patrón que `observacion` en `movimiento-dialog.tsx`).
  const detalle = useWatch({ control: form.control, name: "detalle" });

  const submit = form.handleSubmit(async (v) => {
    setErrorServidor(null);
    try {
      if (tipo === "despachar") {
        await onDespachar(orden.id, {
          numeroRemito: normalizarComprobante(v.numeroRemito)!,
          numeroPedidoVenta: normalizarComprobante(v.numeroPedidoVenta),
        });
      } else {
        await onAnular(orden.id, {
          motivo: v.motivo as MotivoAnulacionOrdenCarga,
          detalle: v.detalle.trim() === "" ? null : v.detalle.trim(),
        });
      }
      onClose();
    } catch (err) {
      setErrorServidor(toAppError(err).message);
      onErrorRefrescarStock();
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <p className="text-sm font-medium text-ink">
          {orden.clienteDenominacion} · {orden.destinoNombre}
        </p>
        <p className="text-xs text-ink-soft">{unidades(orden.totalUnidades)} unidades</p>
      </div>

      {tipo === "despachar" ? (
        <>
          <Campo id="numeroRemito" label="Remito" error={errors.numeroRemito?.message} ayuda="Formato NN-NNNNN.">
            <Input
              id="numeroRemito"
              placeholder="06-00001"
              {...form.register("numeroRemito", {
                onBlur: (e) => {
                  const normalizado = normalizarComprobante(e.target.value);
                  if (normalizado) form.setValue("numeroRemito", normalizado);
                },
              })}
            />
          </Campo>
          <Campo
            id="numeroPedidoVenta"
            label="Pedido de venta"
            error={errors.numeroPedidoVenta?.message}
            ayuda="Opcional. Formato NN-NNNNN."
          >
            <Input
              id="numeroPedidoVenta"
              placeholder="02-55202"
              {...form.register("numeroPedidoVenta", {
                onBlur: (e) => {
                  const normalizado = normalizarComprobante(e.target.value);
                  if (normalizado) form.setValue("numeroPedidoVenta", normalizado);
                },
              })}
            />
          </Campo>
        </>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="motivo">Motivo</Label>
          <Controller
            control={form.control}
            name="motivo"
            render={({ field }) => (
              <MotivoSelect
                id="motivo"
                opciones={MOTIVOS_ANULACION}
                value={field.value as MotivoAnulacionOrdenCarga | ""}
                onChange={field.onChange}
                detalle={detalle}
                onDetalleChange={(d) => form.setValue("detalle", d)}
              />
            )}
          />
          {errors.motivo?.message && <p className="text-xs text-rojo">{errors.motivo.message}</p>}
          {errors.detalle?.message && <p className="text-xs text-rojo">{errors.detalle.message}</p>}
        </div>
      )}

      {errorServidor && (
        <p role="alert" className="text-sm text-rojo">
          {errorServidor}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant={tipo === "anular" ? "destructive" : "accent"} disabled={isSubmitting}>
          {tipo === "despachar" ? "Despachar" : "Anular"}
        </Button>
      </div>
    </form>
  );
}

function Campo({
  id,
  label,
  error,
  ayuda,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-rojo">{error}</p> : ayuda ? <p className="text-xs text-ink-soft">{ayuda}</p> : null}
    </div>
  );
}
