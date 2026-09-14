import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toAppError } from "@/lib/api-error";
import { unidades } from "../format";
import {
  MOTIVOS_AJUSTE,
  type AjusteInput,
  type IngresoInput,
  type MotivoAjusteSemillero,
  type ReubicacionInput,
  type StockFilaDto,
  type UbicacionDto,
} from "../types";
import { MotivoSelect } from "./motivo-select";
import type { OperacionStock } from "./stock-panel";

const TITULOS: Record<OperacionStock, string> = {
  ingreso: "Ingreso de stock",
  ajuste: "Ajuste de stock",
  reubicacion: "Reubicar en el galpón",
};

/**
 * Sólo admiten un ajuste negativo (decisión #1077 punto 5): espeja `AjusteRequestValidator`
 * (`SoloNegativo`) del backend. Recuento físico, Error de carga y Otro admiten cualquier signo.
 */
const MOTIVOS_SOLO_NEGATIVO = new Set<MotivoAjusteSemillero>([
  "RoturaPerdida",
  "MuestraAnalisis",
  "DescarteAcopio",
]);

const campos = z.object({
  cantidad: z.string(),
  motivo: z.string(),
  ubicacionDestinoId: z.string(),
  observacion: z.string().max(200, "La observación no puede superar 200 caracteres."),
});
type Values = z.infer<typeof campos>;

/**
 * Las tres operaciones comparten cantidad y observación, pero cada una valida distinto: el ajuste
 * exige motivo (y detalle si es "Otro", más el signo permitido según ese motivo); la reubicación
 * exige destino y no deja superar el disponible mostrado (R5.3); el ingreso sólo pide una cantidad
 * positiva. Todo en un único `superRefine` para que el usuario vea de una todo lo que falta.
 */
function esquema(operacion: OperacionStock, disponible: number) {
  return campos.superRefine((v, ctx) => {
    const cantidad = Number(v.cantidad);
    const numeroInvalido = v.cantidad.trim() === "" || Number.isNaN(cantidad);

    if (operacion === "ajuste") {
      if (numeroInvalido || cantidad === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El ajuste tiene que sumar o restar alguna cantidad.",
          path: ["cantidad"],
        });
      } else if (MOTIVOS_SOLO_NEGATIVO.has(v.motivo as MotivoAjusteSemillero) && cantidad > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ese motivo sólo admite un ajuste negativo.",
          path: ["cantidad"],
        });
      }
      if (v.motivo === "") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Elegí el motivo del ajuste.", path: ["motivo"] });
      } else if (v.motivo === "Otro" && v.observacion.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Escribí el detalle cuando el motivo es "Otro".',
          path: ["observacion"],
        });
      }
      return;
    }

    if (numeroInvalido || cantidad <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La cantidad tiene que ser mayor a 0.", path: ["cantidad"] });
    } else if (operacion === "reubicacion" && cantidad > disponible) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Hay ${unidades(Math.max(disponible, 0))} disponibles: lo reservado por órdenes pendientes no se mueve.`,
        path: ["cantidad"],
      });
    }
    if (operacion === "reubicacion" && v.ubicacionDestinoId === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Elegí a dónde va.", path: ["ubicacionDestinoId"] });
    }
  });
}

interface Props {
  operacion: OperacionStock | null;
  /** El lote × ubicación de origen: viene de la fila desde la que se abrió el diálogo. */
  fila: StockFilaDto | null;
  ubicaciones: UbicacionDto[];
  onIngreso: (input: IngresoInput) => Promise<unknown>;
  onAjuste: (input: AjusteInput) => Promise<unknown>;
  onReubicar: (input: ReubicacionInput) => Promise<unknown>;
  onClose: () => void;
}

/**
 * Ingreso adicional a un lote existente (R5.1, decisión #1077 punto 2: es su propia operación,
 * `TipoMovimientoSemillero.Ingreso` de nuevo, distinta de un ajuste), ajuste con motivo de lista
 * cerrada y signo restringido según el motivo (R5.2, decisión #1077 punto 5) y reubicación entre
 * ubicaciones validada contra el disponible, no el físico (R5.3). Los tres operan siempre sobre el
 * lote × ubicación de la fila desde la que se abrió el diálogo (mismo patrón que
 * `StockPanel.onMovimiento`).
 */
export function MovimientoDialog({ operacion, fila, onClose, ...resto }: Props) {
  const abierto = operacion !== null && fila !== null;
  return (
    <Modal open={abierto} onClose={onClose} title={abierto ? TITULOS[operacion] : ""}>
      {abierto && (
        <MovimientoForm
          key={`${operacion}-${fila.loteId}-${fila.ubicacionId}`}
          operacion={operacion}
          fila={fila}
          onClose={onClose}
          {...resto}
        />
      )}
    </Modal>
  );
}

function MovimientoForm({
  operacion,
  fila,
  ubicaciones,
  onIngreso,
  onAjuste,
  onReubicar,
  onClose,
}: Omit<Props, "operacion" | "fila"> & { operacion: OperacionStock; fila: StockFilaDto }) {
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(esquema(operacion, fila.disponible)),
    defaultValues: { cantidad: "", motivo: "", ubicacionDestinoId: "", observacion: "" },
  });
  const { errors, isSubmitting } = form.formState;

  // Excluye la propia ubicación de origen y las desactivadas: no se reubica a donde ya está ni a
  // un lugar que dejó de usarse.
  const destinos = ubicaciones.filter((u) => u.activo && u.id !== fila.ubicacionId);

  // `useWatch` y no `form.watch()`: el compilador de React no puede memoizar `watch`, y acá hace
  // falta releer "observacion" en cada tecla para que el detalle de `MotivoSelect` no quede viejo.
  const observacion = useWatch({ control: form.control, name: "observacion" });

  const submit = form.handleSubmit(async (v) => {
    setErrorServidor(null);
    const cantidad = Number(v.cantidad);
    const nota = v.observacion.trim() === "" ? null : v.observacion.trim();
    try {
      if (operacion === "ingreso") {
        await onIngreso({ loteId: fila.loteId, ubicacionId: fila.ubicacionId, cantidad, observacion: nota });
      } else if (operacion === "ajuste") {
        await onAjuste({
          loteId: fila.loteId,
          ubicacionId: fila.ubicacionId,
          cantidad,
          motivo: v.motivo as MotivoAjusteSemillero,
          observacion: nota,
        });
      } else {
        await onReubicar({
          loteId: fila.loteId,
          ubicacionOrigenId: fila.ubicacionId,
          ubicacionDestinoId: Number(v.ubicacionDestinoId),
          cantidad,
          observacion: nota,
        });
      }
      onClose();
    } catch (err) {
      setErrorServidor(toAppError(err).message);
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <p className="text-sm font-medium text-ink">
          {fila.loteCodigo} · {fila.variedad} · {fila.ubicacion}
        </p>
        <p className="text-xs text-ink-soft">
          Físico {unidades(fila.fisico)} · Disponible {unidades(fila.disponible)}
        </p>
      </div>

      <Campo id="cantidad" label="Cantidad" error={errors.cantidad?.message}>
        <Input
          id="cantidad"
          type="number"
          step="0.01"
          min={operacion === "ajuste" ? undefined : "0"}
          {...form.register("cantidad")}
        />
      </Campo>

      {operacion === "ajuste" && (
        <div className="space-y-1.5">
          <Label htmlFor="motivo">Motivo</Label>
          <Controller
            control={form.control}
            name="motivo"
            render={({ field }) => (
              <MotivoSelect
                id="motivo"
                opciones={MOTIVOS_AJUSTE}
                value={field.value as MotivoAjusteSemillero | ""}
                onChange={field.onChange}
                detalle={observacion}
                onDetalleChange={(d) => form.setValue("observacion", d)}
              />
            )}
          />
          {errors.motivo?.message && <p className="text-xs text-rojo">{errors.motivo.message}</p>}
          {errors.observacion?.message && <p className="text-xs text-rojo">{errors.observacion.message}</p>}
        </div>
      )}

      {operacion === "reubicacion" && (
        <Campo id="ubicacionDestinoId" label="Destino" error={errors.ubicacionDestinoId?.message}>
          <Select id="ubicacionDestinoId" {...form.register("ubicacionDestinoId")}>
            <option value="">Elegí…</option>
            {destinos.map((u) => (
              <option key={u.id} value={u.id}>
                {u.codigo}
              </option>
            ))}
          </Select>
        </Campo>
      )}

      {operacion !== "ajuste" && (
        <Campo id="observacion" label="Observación">
          <Textarea id="observacion" rows={2} {...form.register("observacion")} />
        </Campo>
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
        <Button type="submit" variant="accent" disabled={isSubmitting}>
          Confirmar
        </Button>
      </div>
    </form>
  );
}

function Campo({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-rojo">{error}</p> : null}
    </div>
  );
}
