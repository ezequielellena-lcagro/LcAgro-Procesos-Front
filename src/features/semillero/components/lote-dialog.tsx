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
import { CampaniaSelect } from "@/shared/components/campania-select";
import {
  DUENIOS,
  ENVASES,
  type ClienteCopiaDto,
  type EspecieDto,
  type EnvaseSemillero,
  type LoteAltaInput,
  type LoteDatosInput,
  type LoteDto,
  type UbicacionDto,
  type VariedadDto,
} from "../types";
import { ClienteSelect } from "./cliente-select";

const pesoPorDefecto = (envase: EnvaseSemillero) =>
  ENVASES.find((e) => e.valor === envase)!.pesoPorDefecto;

const campos = z.object({
  codigo: z
    .string()
    .trim()
    .min(1, "Escribí el código del lote.")
    .max(40, "El código del lote no puede superar 40 caracteres."),
  campania: z.string().min(1, "Elegí la campaña."),
  variedadId: z.string().min(1, "Elegí la variedad."),
  envase: z.enum(["BigBag", "Bolsa"]),
  pesoUnitarioKg: z.string().refine((v) => Number(v) > 0, "El peso unitario tiene que ser mayor a 0."),
  tratada: z.boolean(),
  pg: z
    .string()
    .refine((v) => v === "" || (Number(v) >= 0 && Number(v) <= 100), "El PG es un porcentaje entre 0 y 100."),
  pmil: z.string().refine((v) => v === "" || Number(v) > 0, "El PMIL tiene que ser mayor a 0."),
  observaciones: z.string().max(500, "Las observaciones no pueden superar 500 caracteres."),
  duenio: z.enum(["Propio", "Cliente"]),
  clienteNumero: z.number().nullable(),
  ubicacionId: z.string(),
  cantidad: z.string(),
});
type Values = z.infer<typeof campos>;

/**
 * En el alta además hacen falta la ubicación y la cantidad del ingreso inicial (R3.1); con dueño
 * Cliente además hace falta el cliente (ADR-07). Van como refinamientos aparte de los `RuleFor`
 * simples: zod acumula todos los issues del objeto, así el usuario ve de una todo lo que falta.
 */
function esquema(esAlta: boolean) {
  const base = esAlta
    ? campos.extend({
        ubicacionId: z.string().min(1, "Elegí la ubicación."),
        cantidad: z.string().refine((v) => Number(v) > 0, "La cantidad tiene que ser mayor a 0."),
      })
    : campos;
  return base.superRefine((v, ctx) => {
    if (v.duenio === "Cliente" && v.clienteNumero === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Elegí el cliente.", path: ["clienteNumero"] });
    }
  });
}

const numeroOpcional = (v: string) => (v === "" ? null : Number(v));

function aValues(lote: LoteDto | null, campaniaSugerida: string): Values {
  if (!lote) {
    return {
      codigo: "",
      campania: campaniaSugerida,
      variedadId: "",
      envase: "BigBag",
      pesoUnitarioKg: String(pesoPorDefecto("BigBag")),
      tratada: false,
      pg: "",
      pmil: "",
      observaciones: "",
      duenio: "Propio",
      clienteNumero: null,
      ubicacionId: "",
      cantidad: "",
    };
  }
  return {
    codigo: lote.codigo,
    campania: lote.campania,
    variedadId: String(lote.variedadId),
    envase: lote.envase,
    pesoUnitarioKg: String(lote.pesoUnitarioKg),
    tratada: lote.tratada,
    pg: lote.pg === null ? "" : String(lote.pg),
    pmil: lote.pmil === null ? "" : String(lote.pmil),
    observaciones: lote.observaciones ?? "",
    duenio: lote.duenio,
    clienteNumero: lote.clienteNumero,
    ubicacionId: "",
    cantidad: "",
  };
}

interface Props {
  open: boolean;
  /** `null` = alta. */
  lote: LoteDto | null;
  variedades: VariedadDto[];
  especies?: EspecieDto[];
  ubicaciones: UbicacionDto[];
  campanias: string[];
  campaniaSugerida: string;
  clientes: ClienteCopiaDto[];
  onCrear: (input: LoteAltaInput) => Promise<unknown>;
  onActualizar: (id: number, input: LoteDatosInput) => Promise<unknown>;
  onClose: () => void;
}

/**
 * Alta y edición de un lote (R3.1-R3.3). El alta siempre viaja con el ingreso inicial (ubicación +
 * cantidad); al editar esos dos campos no aparecen, el stock sólo cambia con movimientos (R3.2).
 *
 * El dueño (Propio/Cliente) y, desde la decisión #4 de la fase, el envase y el peso unitario quedan
 * bloqueados una vez que el lote tuvo cualquier movimiento aparte de su ingreso inicial —la misma
 * condición para ambos grupos (`duenioEditable`/`envaseYPesoEditables`, calculados por el backend con
 * `ReglaDuenio.AtributosSensiblesEditables`)—; el resto de los atributos sigue editable siempre.
 */
export function LoteDialog({ open, lote, onClose, ...resto }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lote ? `Editar lote ${lote.codigo}` : "Nuevo lote"}
      className="max-w-3xl"
    >
      <LoteForm key={lote?.id ?? "alta"} lote={lote} onClose={onClose} {...resto} />
    </Modal>
  );
}

function LoteForm({
  lote,
  variedades,
  especies = [],
  ubicaciones,
  campanias,
  campaniaSugerida,
  clientes,
  onCrear,
  onActualizar,
  onClose,
}: Omit<Props, "open">) {
  const esAlta = lote === null;
  const duenioEditable = esAlta || lote.duenioEditable;
  const envaseYPesoEditables = esAlta || lote.envaseYPesoEditables;
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(esquema(esAlta)),
    defaultValues: aValues(lote, campaniaSugerida),
  });
  const { errors, isSubmitting } = form.formState;

  // Una variedad desactivada no se ofrece para lotes nuevos, pero un lote que ya la tiene la conserva.
  const opciones = variedades.filter((v) => v.activo || v.id === lote?.variedadId);

  const submit = form.handleSubmit(async (v) => {
    setErrorServidor(null);
    const datos: LoteDatosInput = {
      codigo: v.codigo.trim(),
      campania: v.campania,
      variedadId: Number(v.variedadId),
      envase: v.envase,
      pesoUnitarioKg: Number(v.pesoUnitarioKg),
      tratada: v.tratada,
      pg: numeroOpcional(v.pg),
      pmil: numeroOpcional(v.pmil),
      observaciones: v.observaciones.trim() === "" ? null : v.observaciones.trim(),
      duenio: v.duenio,
      clienteNumero: v.duenio === "Cliente" ? v.clienteNumero : null,
    };
    try {
      if (esAlta) await onCrear({ ...datos, ubicacionId: Number(v.ubicacionId), cantidad: Number(v.cantidad) });
      else await onActualizar(lote.id, datos);
      onClose();
    } catch (err) {
      setErrorServidor(toAppError(err).message);
    }
  });

  // `useWatch` y no `form.watch()`: el compilador de React no puede memoizar `watch`, y con un
  // campo controlado eso deriva en UI desactualizada (mismo patrón que `prestamo-dialog.tsx`).
  const duenioElegido = useWatch({ control: form.control, name: "duenio" });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="codigo" label="Código de lote" error={errors.codigo?.message}>
          <Input id="codigo" placeholder="26S-001" {...form.register("codigo")} />
        </Campo>
        <Campo id="campania" label="Campaña" error={errors.campania?.message}>
          <Controller
            control={form.control}
            name="campania"
            render={({ field }) => (
              <CampaniaSelect id="campania" value={field.value} campanias={campanias} onChange={field.onChange} />
            )}
          />
        </Campo>
        <Campo id="variedadId" label="Variedad" error={errors.variedadId?.message}>
          <Select id="variedadId" {...form.register("variedadId")}>
            <option value="">Elegí…</option>
            {especies.map((e) => (
              <optgroup key={e.codigoRubro} label={e.nombre}>
                {opciones
                  .filter((v) => v.especie === e.nombre)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </Campo>
        <Campo id="envase" label="Envase">
          <Select
            id="envase"
            disabled={!envaseYPesoEditables}
            {...form.register("envase", {
              onChange: (e) =>
                form.setValue("pesoUnitarioKg", String(pesoPorDefecto(e.target.value as EnvaseSemillero))),
            })}
          >
            {ENVASES.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo id="pesoUnitarioKg" label="Peso unitario (kg)" error={errors.pesoUnitarioKg?.message}>
          <Input
            id="pesoUnitarioKg"
            type="number"
            min="0"
            step="0.01"
            disabled={!envaseYPesoEditables}
            {...form.register("pesoUnitarioKg")}
          />
        </Campo>
        {!envaseYPesoEditables && (
          <p className="text-xs text-ink-soft sm:col-span-2">
            El envase y el peso quedan fijos porque el lote ya tiene movimientos además del ingreso
            inicial.
          </p>
        )}
        <div className="flex items-end pb-2">
          <label htmlFor="tratada" className="flex items-center gap-2 text-sm text-ink">
            <input
              id="tratada"
              type="checkbox"
              className="size-4 accent-clementina-deep"
              {...form.register("tratada")}
            />
            Tratada
          </label>
        </div>
        <Campo id="pg" label="PG %" error={errors.pg?.message} ayuda="Poder germinativo.">
          <Input id="pg" type="number" min="0" max="100" step="0.1" {...form.register("pg")} />
        </Campo>
        <Campo id="pmil" label="PMIL g" error={errors.pmil?.message} ayuda="Peso de mil semillas.">
          <Input id="pmil" type="number" min="0" step="0.1" {...form.register("pmil")} />
        </Campo>
        <Campo id="duenio" label="Dueño" error={errors.duenio?.message}>
          <Select id="duenio" disabled={!duenioEditable} {...form.register("duenio")}>
            {DUENIOS.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.etiqueta}
              </option>
            ))}
          </Select>
        </Campo>
        {duenioElegido === "Cliente" && (
          <Campo id="clienteNumero" label="Cliente" error={errors.clienteNumero?.message}>
            <Controller
              control={form.control}
              name="clienteNumero"
              render={({ field }) => (
                <ClienteSelect
                  id="clienteNumero"
                  clientes={clientes}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!duenioEditable}
                />
              )}
            />
          </Campo>
        )}
        {esAlta && (
          <>
            <Campo id="ubicacionId" label="Ubicación" error={errors.ubicacionId?.message}>
              <Select id="ubicacionId" {...form.register("ubicacionId")}>
                <option value="">Elegí…</option>
                {ubicaciones
                  .filter((u) => u.activo)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.codigo}
                    </option>
                  ))}
              </Select>
            </Campo>
            <Campo id="cantidad" label="Cantidad" error={errors.cantidad?.message} ayuda="Envases que entran al galpón.">
              <Input id="cantidad" type="number" min="0" step="0.01" {...form.register("cantidad")} />
            </Campo>
          </>
        )}
      </div>
      <Campo id="observaciones" label="Observaciones" error={errors.observaciones?.message}>
        <Textarea id="observaciones" rows={2} {...form.register("observaciones")} />
      </Campo>
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
          Guardar
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
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-rojo">{error}</p> : ayuda ? <p className="text-xs text-ink-soft">{ayuda}</p> : null}
    </div>
  );
}
