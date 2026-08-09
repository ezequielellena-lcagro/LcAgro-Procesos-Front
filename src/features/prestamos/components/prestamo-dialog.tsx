import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wand2 } from "lucide-react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toAppError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { FilaCuota } from "../cronograma";
import {
  useActualizarPrestamo,
  useCrearPrestamo,
  useSimularCronograma,
} from "../queries/use-prestamo-mutations";
import { useCatalogosPrestamos, usePrestamo } from "../queries/use-prestamos";
import {
  PERIODICIDADES,
  TIPOS,
  type Moneda,
  type Periodicidad,
  type PrestamoDetalleDto,
} from "../types";
import { CronogramaEditor } from "./cronograma-editor";

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Convierte "" → null y acepta coma decimal. */
function numeroOpcional(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const schema = z.object({
  bancoId: z.string().min(1, "Elegí el banco."),
  sucursal: z.string().max(60),
  lineaCreditoId: z.string().min(1, "Elegí la línea de crédito."),
  nroOperacion: z.string().max(30),
  moneda: z.enum(["ARS", "USD"]),
  tipo: z.enum(["Prestamo", "FinanciacionProveedor", "Leasing"]),
  capitalOriginal: z.string(),
  fechaOtorgamiento: z.string(),
  cantidadCuotas: z.string(),
  periodicidad: z.string(),
  tasaNominalAnual: z.string(),
  observaciones: z.string().max(500),
});
type Values = z.infer<typeof schema>;

const VACIO: Values = {
  bancoId: "",
  sucursal: "",
  lineaCreditoId: "",
  nroOperacion: "",
  moneda: "USD",
  tipo: "Prestamo",
  capitalOriginal: "",
  fechaOtorgamiento: "",
  cantidadCuotas: "",
  periodicidad: "Unico",
  tasaNominalAnual: "",
  observaciones: "",
};

function aValues(p: PrestamoDetalleDto): Values {
  return {
    bancoId: String(p.bancoId),
    sucursal: p.sucursal ?? "",
    lineaCreditoId: String(p.lineaCreditoId),
    nroOperacion: p.nroOperacion ?? "",
    moneda: p.moneda,
    tipo: p.tipo,
    capitalOriginal: p.capitalOriginal === null ? "" : String(p.capitalOriginal),
    fechaOtorgamiento: p.fechaOtorgamiento ?? "",
    cantidadCuotas: String(p.cantidadCuotas),
    periodicidad: p.periodicidad,
    tasaNominalAnual: p.tasaNominalAnual === null ? "" : String(p.tasaNominalAnual),
    observaciones: p.observaciones ?? "",
  };
}

/**
 * Un campo del formulario: rótulo, control y una sola línea debajo — el error si lo hay, la ayuda
 * si no. Que sea siempre la misma pieza es lo que hace que la grilla quede pareja.
 */
function Campo({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-rojo">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

/** Un tramo del formulario, con su título. Ordena la carga en pasos legibles. */
function Bloque({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3 border-b border-line pb-1.5">
        <h3 className="font-display text-sm font-semibold text-ink">{titulo}</h3>
        {ayuda ? <p className="text-xs text-ink-soft">{ayuda}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Campo de importe o porcentaje: el símbolo va dentro del control y el número alineado a la
 * derecha, en tabular. Es la misma convención que las tablas de la app — una columna de plata
 * se lee por la coma, no por el borde izquierdo.
 */
function CampoNumerico({
  simbolo,
  posicion,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { simbolo: ReactNode; posicion: "izq" | "der" }) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-ink-soft",
          posicion === "izq" ? "left-3" : "right-3",
        )}
      >
        {simbolo}
      </span>
      <Input
        inputMode="decimal"
        className={cn("tabular text-right", posicion === "izq" ? "pl-12" : "pr-8", className)}
        {...props}
      />
    </div>
  );
}

/** El símbolo del capital sigue a la moneda elegida, sin re-renderizar el formulario entero. */
function SimboloMoneda({ control }: { control: Control<Values> }) {
  return <>{useWatch({ control, name: "moneda" }) === "ARS" ? "$" : "U$S"}</>;
}

interface Props {
  /** `null` = cerrado · `0` = alta · id > 0 = edición. */
  prestamoId: number | null;
  onClose: () => void;
  monedaPorDefecto: Moneda;
}

/**
 * Alta y edición de una operación: cabecera + cronograma.
 *
 * El cronograma se propone con el asistente y queda editable celda por celda: los bancos no usan
 * meses calendario exactos y el interés lo liquida el banco, así que una fórmula teórica nunca
 * coincide. Las cuotas ya pagadas se muestran bloqueadas — son historia.
 *
 * Este componente sólo resuelve la carga; el formulario en sí es `PrestamoForm`, que se monta con
 * `key` recién cuando los datos están. Así el estado inicial sale del `useState` y no hace falta
 * sincronizarlo con un efecto (que además dispararía `setState` en render).
 */
export function PrestamoDialog({ prestamoId, onClose, monedaPorDefecto }: Props) {
  const esAlta = prestamoId === 0;
  const detalle = usePrestamo(prestamoId !== null && prestamoId > 0 ? prestamoId : null);
  const listo = esAlta || detalle.data !== undefined;

  return (
    <Modal
      open={prestamoId !== null}
      onClose={onClose}
      title={esAlta ? "Nuevo préstamo" : "Editar préstamo"}
      className="max-w-5xl"
    >
      {!listo ? (
        <p className="py-8 text-center text-ink-soft">Cargando el préstamo…</p>
      ) : (
        <PrestamoForm
          key={prestamoId}
          prestamoId={prestamoId!}
          detalle={esAlta ? null : detalle.data!}
          monedaPorDefecto={monedaPorDefecto}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function PrestamoForm({
  prestamoId,
  detalle,
  monedaPorDefecto,
  onClose,
}: {
  prestamoId: number;
  detalle: PrestamoDetalleDto | null;
  monedaPorDefecto: Moneda;
  onClose: () => void;
}) {
  const esAlta = detalle === null;
  const catalogos = useCatalogosPrestamos();
  const crear = useCrearPrestamo();
  const actualizar = useActualizarPrestamo();
  const simular = useSimularCronograma();

  const [cuotas, setCuotas] = useState<FilaCuota[]>(() =>
    (detalle?.cuotas ?? []).map((c) => ({
      nroCuota: c.nroCuota,
      fechaVencimiento: c.fechaVencimiento,
      capital: c.capital,
      interes: c.interes,
      iva: c.iva,
      observacion: c.observacion,
    })),
  );
  const [primerVto, setPrimerVto] = useState(
    () => detalle?.cuotas[0]?.fechaVencimiento ?? hoyISO(),
  );

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: detalle ? aValues(detalle) : { ...VACIO, moneda: monedaPorDefecto },
  });

  const pagadas = (detalle?.cuotas ?? [])
    .filter((c) => c.estado === "Pagada")
    .map((c) => c.nroCuota);

  const generar = async () => {
    const capital = numeroOpcional(form.getValues("capitalOriginal"));
    const cantidad = Number(form.getValues("cantidadCuotas") || "1");
    if (capital === null || capital <= 0) {
      toast.error("Cargá el capital original para generar el cronograma.");
      return;
    }
    try {
      const propuesta = await simular.mutateAsync({
        capital,
        cantidadCuotas: cantidad,
        periodicidad: form.getValues("periodicidad") as Periodicidad,
        primerVencimiento: primerVto,
      });
      setCuotas(propuesta.map((c) => ({ ...c })));
      toast.info("Cronograma propuesto. Ajustá las fechas y los intereses según el banco.");
    } catch (err) {
      toast.error(toAppError(err).message);
    }
  };

  const submit = form.handleSubmit(async (v) => {
    if (cuotas.length === 0) {
      toast.error("El préstamo tiene que tener al menos una cuota.");
      return;
    }
    const input = {
      bancoId: Number(v.bancoId),
      sucursal: v.sucursal.trim() === "" ? null : v.sucursal.trim(),
      lineaCreditoId: Number(v.lineaCreditoId),
      nroOperacion: v.nroOperacion.trim() === "" ? null : v.nroOperacion.trim(),
      moneda: v.moneda,
      tipo: v.tipo,
      capitalOriginal: numeroOpcional(v.capitalOriginal),
      fechaOtorgamiento: v.fechaOtorgamiento === "" ? null : v.fechaOtorgamiento,
      cantidadCuotas: v.cantidadCuotas === "" ? null : Number(v.cantidadCuotas),
      periodicidad: v.periodicidad as Periodicidad,
      tasaNominalAnual: numeroOpcional(v.tasaNominalAnual),
      observaciones: v.observaciones.trim() === "" ? null : v.observaciones.trim(),
      cuotas: cuotas.map((c) => ({
        nroCuota: c.nroCuota,
        fechaVencimiento: c.fechaVencimiento,
        capital: c.capital,
        interes: c.interes,
        iva: c.iva,
        observacion: c.observacion ?? null,
      })),
    };

    try {
      if (esAlta) await crear.mutateAsync(input);
      else await actualizar.mutateAsync({ id: prestamoId, ...input });
      onClose();
    } catch (err) {
      const e = toAppError(err);
      if (e.fieldErrors) {
        for (const [campo, msgs] of Object.entries(e.fieldErrors)) {
          const name = (campo.charAt(0).toLowerCase() + campo.slice(1)).replace(
            /\[\d+\].*/g,
            "",
          ) as keyof Values;
          if (name in VACIO) form.setError(name, { message: msgs[0] });
        }
        toast.error(e.message);
      } else {
        toast.error(e.message);
      }
    }
  });

  const guardando = crear.isPending || actualizar.isPending;
  const { errors } = form.formState;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Bloque titulo="La operación" ayuda="Con quién y de qué tipo.">
        <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-3">
          <Campo label="Banco" htmlFor="bancoId" error={errors.bancoId?.message}>
            <Select id="bancoId" {...form.register("bancoId")} disabled={catalogos.isPending}>
              <option value="">Elegí…</option>
              {catalogos.data?.bancos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Sucursal" htmlFor="sucursal">
            <Input id="sucursal" placeholder="SAN JORGE" {...form.register("sucursal")} />
          </Campo>

          <Campo
            label="Línea de crédito"
            htmlFor="lineaCreditoId"
            error={errors.lineaCreditoId?.message}
          >
            <Select
              id="lineaCreditoId"
              {...form.register("lineaCreditoId")}
              disabled={catalogos.isPending}
            >
              <option value="">Elegí…</option>
              {catalogos.data?.lineas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo
            label="N° de operación"
            htmlFor="nroOperacion"
            hint="Con esto se cruza contra MacroGest."
          >
            <Input id="nroOperacion" placeholder="28078488" {...form.register("nroOperacion")} />
          </Campo>

          <Campo label="Moneda" htmlFor="moneda">
            <Select id="moneda" {...form.register("moneda")}>
              <option value="USD">Dólares (U$S)</option>
              <option value="ARS">Pesos ($)</option>
            </Select>
          </Campo>

          <Campo label="Tipo" htmlFor="tipo">
            <Select id="tipo" {...form.register("tipo")}>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
      </Bloque>

      <Bloque titulo="Condiciones" ayuda="Lo que dice el contrato. Todo opcional.">
        <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-3">
          <Campo label="Capital original" htmlFor="capitalOriginal">
            <CampoNumerico
              id="capitalOriginal"
              posicion="izq"
              simbolo={<SimboloMoneda control={form.control} />}
              placeholder="0,00"
              {...form.register("capitalOriginal")}
            />
          </Campo>

          <Campo label="Fecha de otorgamiento" htmlFor="fechaOtorgamiento">
            {/* Controller y no `watch()`: el compilador de React no puede memoizar `watch`, y con
                un campo controlado eso deriva en UI desactualizada. */}
            <Controller
              control={form.control}
              name="fechaOtorgamiento"
              render={({ field }) => (
                <DateField id="fechaOtorgamiento" value={field.value} onChange={field.onChange} />
              )}
            />
          </Campo>

          <Campo label="Tasa nominal anual" htmlFor="tasaNominalAnual">
            <CampoNumerico
              id="tasaNominalAnual"
              posicion="der"
              simbolo="%"
              placeholder="0,00"
              {...form.register("tasaNominalAnual")}
            />
          </Campo>
        </div>
      </Bloque>

      <Bloque
        titulo="Cronograma"
        ayuda="El asistente propone; los números finales son los del banco."
      >
        <div className="rounded-card border border-line bg-panel-soft p-3.5">
          <div className="grid items-end gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo label="Cantidad de cuotas" htmlFor="cantidadCuotas">
              <Input
                id="cantidadCuotas"
                type="number"
                min="1"
                max="360"
                placeholder="8"
                className="tabular text-right"
                {...form.register("cantidadCuotas")}
              />
            </Campo>

            <Campo label="Periodicidad" htmlFor="periodicidad">
              <Select id="periodicidad" {...form.register("periodicidad")}>
                {PERIODICIDADES.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.etiqueta}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo label="Primer vencimiento" htmlFor="primerVto">
              <DateField id="primerVto" value={primerVto} onChange={setPrimerVto} />
            </Campo>

            <Button
              type="button"
              variant="outline"
              onClick={generar}
              disabled={simular.isPending || guardando}
            >
              <Wand2 className="mr-1 size-4" />
              {simular.isPending ? "Generando…" : "Generar cuotas"}
            </Button>
          </div>

          <p className="mt-2.5 text-xs text-ink-soft">
            Reparte el capital y avanza por periodicidad. Después ajustá las fechas y cargá el
            interés del cuadro de marcha; el <strong>IVA se completa solo al 12 %</strong> (10,5 % +
            1,5 %) y se puede pisar. La cantidad incluye las cuotas ya pagadas, aunque cargues sólo
            las que faltan.
          </p>
        </div>

        <CronogramaEditor
          cuotas={cuotas}
          onChange={setCuotas}
          bloqueadas={pagadas}
          disabled={guardando}
        />
      </Bloque>

      <Campo label="Observaciones" htmlFor="observaciones">
        <Textarea id="observaciones" rows={2} {...form.register("observaciones")} />
      </Campo>

      {/* Pegado al pie: el formulario es largo y Guardar no se tiene que ir de la vista. */}
      <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-line bg-panel px-5 py-3.5">
        <Button type="button" variant="outline" onClick={onClose} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
