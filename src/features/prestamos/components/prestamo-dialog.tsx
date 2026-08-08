import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wand2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
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
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="bancoId">Banco</Label>
          <Select id="bancoId" {...form.register("bancoId")} disabled={catalogos.isPending}>
            <option value="">Elegí…</option>
            {catalogos.data?.bancos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </Select>
          {errors.bancoId && <p className="text-xs text-rojo">{errors.bancoId.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sucursal">Sucursal</Label>
          <Input id="sucursal" placeholder="SAN JORGE" {...form.register("sucursal")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lineaCreditoId">Línea de crédito</Label>
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
          {errors.lineaCreditoId && (
            <p className="text-xs text-rojo">{errors.lineaCreditoId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nroOperacion">N° de operación</Label>
          <Input id="nroOperacion" {...form.register("nroOperacion")} />
          <p className="text-xs text-ink-soft">Opcional: no todas las operaciones lo traen.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="moneda">Moneda</Label>
          <Select id="moneda" {...form.register("moneda")}>
            <option value="USD">Dólares (U$S)</option>
            <option value="ARS">Pesos ($)</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tipo">Tipo</Label>
          <Select id="tipo" {...form.register("tipo")}>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="capitalOriginal">Capital original</Label>
          <Input id="capitalOriginal" inputMode="decimal" {...form.register("capitalOriginal")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fechaOtorgamiento">Fecha de otorgamiento</Label>
          {/* Controller y no `watch()`: el compilador de React no puede memoizar `watch`, y con
                un campo controlado eso deriva en UI desactualizada. */}
          <Controller
            control={form.control}
            name="fechaOtorgamiento"
            render={({ field }) => (
              <DateField id="fechaOtorgamiento" value={field.value} onChange={field.onChange} />
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tasaNominalAnual">TNA (%)</Label>
          <Input id="tasaNominalAnual" inputMode="decimal" {...form.register("tasaNominalAnual")} />
        </div>
      </div>

      {/* Asistente de cronograma */}
      <fieldset className="space-y-3 rounded-card border border-line bg-panel-soft p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Cronograma
        </legend>
        <div className="grid items-end gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="cantidadCuotas">Cantidad de cuotas</Label>
            <Input
              id="cantidadCuotas"
              type="number"
              min="1"
              max="360"
              {...form.register("cantidadCuotas")}
            />
            <p className="text-xs text-ink-soft">
              Total del préstamo, aunque cargues sólo las que faltan pagar.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="periodicidad">Periodicidad</Label>
            <Select id="periodicidad" {...form.register("periodicidad")}>
              {PERIODICIDADES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="primerVto">Primer vencimiento</Label>
            <DateField id="primerVto" value={primerVto} onChange={setPrimerVto} />
          </div>
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

        <p className="text-xs text-ink-soft">
          El asistente reparte el capital y avanza por periodicidad. Es una propuesta: ajustá las
          fechas y cargá el interés y el IVA del cuadro de marcha del banco. El IVA se completa solo
          al 12 % (10,5 % + 1,5 %) y podés pisarlo.
        </p>

        <CronogramaEditor
          cuotas={cuotas}
          onChange={setCuotas}
          bloqueadas={pagadas}
          disabled={guardando}
        />
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Textarea id="observaciones" rows={2} {...form.register("observaciones")} />
      </div>

      <div className="flex justify-end gap-2">
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
