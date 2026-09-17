import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { toAppError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { kg, unidades } from "../format";
import { normalizarComprobante } from "../lib/comprobante";
import { duenioEtiqueta, productoEtiqueta } from "../lib/etiquetas-lote";
import {
  clienteActivoDeLote,
  excedidos,
  lotesElegibles,
  mismaClave,
  renglonesDeOtroCliente,
  totalesOrden,
  type LoteElegible,
  type RenglonEditable,
} from "../lib/orden";
import type {
  ClienteCopiaDto,
  DestinoDto,
  EstadoCopiaClientesDto,
  OrdenCargaDto,
  OrdenCargaInput,
  StockFilaDto,
} from "../types";
import { AgregarRenglon } from "./agregar-renglon";
import { ClienteSelect } from "./cliente-select";
import { CopiaClientesAviso } from "./copia-clientes-aviso";
import { DestinoSelect } from "./destino-select";

const campos = z.object({
  clienteNumero: z.number().nullable(),
  destinoId: z.number().nullable(),
  numeroPedidoVenta: z.string(),
  observaciones: z.string().max(500, "Las observaciones no pueden superar 500 caracteres."),
});
type Values = z.infer<typeof campos>;

/**
 * Cliente y destino son obligatorios (R6.1); el pedido de venta es opcional pero, si se completa,
 * tiene que respetar el formato `NN-NNNNN` (R6.2) — se reutiliza `normalizarComprobante` para no
 * duplicar la regla del formato entre la validación y la normalización real.
 */
function esquema() {
  return campos.superRefine((v, ctx) => {
    if (v.clienteNumero === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Elegí el cliente.", path: ["clienteNumero"] });
    }
    if (v.destinoId === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Elegí el destino.", path: ["destinoId"] });
    }
    if (v.numeroPedidoVenta.trim() !== "" && normalizarComprobante(v.numeroPedidoVenta) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El pedido tiene que tener el formato NN-NNNNN.",
        path: ["numeroPedidoVenta"],
      });
    }
  });
}

function aValues(orden: OrdenCargaDto | null, clienteDeAlta: number | null): Values {
  if (!orden) {
    return { clienteNumero: clienteDeAlta, destinoId: null, numeroPedidoVenta: "", observaciones: "" };
  }
  return {
    clienteNumero: orden.clienteNumero,
    destinoId: orden.destinoId,
    numeroPedidoVenta: orden.numeroPedidoVenta ?? "",
    observaciones: orden.observaciones ?? "",
  };
}

function aRenglones(orden: OrdenCargaDto | null): RenglonEditable[] {
  return orden === null
    ? []
    : orden.items.map((it) => ({ loteId: it.loteId, ubicacionId: it.ubicacionId, cantidad: it.cantidad }));
}

interface Props {
  open: boolean;
  /** `null` = alta. */
  orden: OrdenCargaDto | null;
  clientes: ClienteCopiaDto[];
  copiaClientes: EstadoCopiaClientesDto;
  actualizandoClientes: boolean;
  onActualizarClientes: () => void;
  /**
   * Stock completo, sin los filtros de la pestaña Stock: al editar, los lotes de la orden tienen que
   * estar siempre (si no, el renglón queda sin datos y su máximo en 0).
   */
  filas: StockFilaDto[];
  /**
   * Fila de Stock desde la que se pidió la orden (botón "Orden", R4): prefija los filtros, el lote y,
   * si es de un cliente activo, el cliente. Sólo cuenta para un alta.
   */
  filaOrigen?: StockFilaDto | null;
  /** Destinos del cliente elegido en el formulario (R1.3); el padre los mantiene al día con `onClienteChange`. */
  destinos: DestinoDto[];
  onClienteChange?: (clienteNumero: number | null) => void;
  onAgregarDestino: (nombre: string) => Promise<DestinoDto>;
  onCrear: (input: OrdenCargaInput) => Promise<unknown>;
  onActualizar: (id: number, input: OrdenCargaInput) => Promise<unknown>;
  onClose: () => void;
}

/**
 * Armado y edición de una orden de carga (R6.1-R6.3), en el orden cliente → destino → pedido → lotes
 * (design-anexo §14). El cliente sólo ofrece los activos de la copia local (decisión #3): nunca se
 * arma la lista a partir de quién tiene stock propio en planta. Sin cliente elegido no aparece ningún
 * lote de Cliente para agregar (R4.4, `lotesElegibles`); al cambiar el cliente de una orden en
 * edición, los renglones que quedaban de otro cliente se marcan (`renglonesDeOtroCliente`) pero no se
 * borran solos — el usuario decide sacarlos, y guardar así queda bloqueado.
 *
 * Los renglones no son un campo de react-hook-form: son un estado propio (`renglones`), igual que
 * `cuotas` en `prestamo-dialog.tsx`, porque son una lista editable que no encaja en un único input.
 */
export function OrdenDialog({ open, orden, onClose, ...resto }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={orden ? `Editar orden N° ${orden.numero}` : "Nueva orden de carga"}
      className="max-w-3xl"
    >
      <OrdenForm key={orden?.id ?? "alta"} orden={orden} onClose={onClose} {...resto} />
    </Modal>
  );
}

function OrdenForm({
  orden,
  clientes,
  copiaClientes,
  actualizandoClientes,
  onActualizarClientes,
  filas,
  filaOrigen = null,
  destinos,
  onClienteChange,
  onAgregarDestino,
  onCrear,
  onActualizar,
  onClose,
}: Omit<Props, "open">) {
  const esAlta = orden === null;
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);
  const [renglones, setRenglones] = useState<RenglonEditable[]>(() => aRenglones(orden));
  // Foto fija de lo que la orden YA reservaba al abrir el diálogo (nunca se reasigna): es lo que pide
  // el JSDoc de `lotesElegibles` ("lo que YA reservaba la propia orden", tiempo pasado). Si en cambio
  // se le pasara el estado vivo `renglones`, el máximo de cada renglón ya cargado se autoinflaría con
  // la propia cantidad recién tipeada y el chequeo de "excede lo disponible" quedaría tautológico.
  const [reservaOriginal] = useState<RenglonEditable[]>(() => aRenglones(orden));

  const loteInicial = esAlta ? filaOrigen : null;
  // Foto fija, como `reservaOriginal`: el formulario arranca una sola vez con este cliente, y el aviso
  // de cliente inactivo tiene que describir ESE arranque aunque la copia de clientes se refresque.
  const [clienteDeAlta] = useState(() => clienteActivoDeLote(loteInicial, clientes));
  const loteDeClienteInactivo = loteInicial?.duenio === "Cliente" && clienteDeAlta === null;

  const form = useForm<Values>({
    resolver: zodResolver(esquema()),
    defaultValues: aValues(orden, clienteDeAlta),
  });
  const { errors, isSubmitting } = form.formState;

  // `useWatch`, no `form.watch()`: el compilador de React no puede memoizar `watch`, y acá hace falta
  // releer el cliente y el destino en cada cambio (mismo patrón que `duenioElegido` en `lote-dialog.tsx`).
  const clienteNumero = useWatch({ control: form.control, name: "clienteNumero" });

  const elegibles: LoteElegible[] = lotesElegibles(filas, reservaOriginal, clienteNumero ?? undefined);
  const invalidos = renglonesDeOtroCliente(renglones, filas, clienteNumero ?? undefined);
  const excedidosActuales = excedidos(renglones, elegibles);
  const cantidadesInvalidas = renglones.filter((r) => !(r.cantidad > 0));
  const totales = totalesOrden(renglones, filas);

  const filaDe = (r: RenglonEditable) => filas.find((f) => mismaClave(f, r));
  const esInvalido = (r: RenglonEditable) => invalidos.some((i) => mismaClave(i, r));
  const excede = (r: RenglonEditable) => excedidosActuales.some((e) => mismaClave(e, r));
  const esCantidadInvalida = (r: RenglonEditable) => cantidadesInvalidas.some((c) => mismaClave(c, r));

  const agregarRenglon = (renglon: RenglonEditable) => setRenglones((r) => [...r, renglon]);

  const quitarRenglon = (loteId: number, ubicacionId: number) =>
    setRenglones((r) => r.filter((x) => !mismaClave(x, { loteId, ubicacionId })));

  const cambiarCantidad = (loteId: number, ubicacionId: number, cantidad: number) =>
    setRenglones((r) => r.map((x) => (mismaClave(x, { loteId, ubicacionId }) ? { ...x, cantidad } : x)));

  const submit = form.handleSubmit(async (v) => {
    setErrorMensaje(null);
    if (renglones.length === 0) {
      setErrorMensaje("La orden necesita al menos un renglón.");
      return;
    }
    if (invalidos.length > 0) {
      setErrorMensaje("Sacá los renglones que ya no corresponden al cliente elegido antes de guardar.");
      return;
    }
    if (cantidadesInvalidas.length > 0) {
      setErrorMensaje("Alguna cantidad no es válida: revisá los renglones marcados.");
      return;
    }
    if (excedidosActuales.length > 0) {
      setErrorMensaje("Alguna cantidad supera el disponible: revisá los renglones marcados.");
      return;
    }
    const input: OrdenCargaInput = {
      clienteNumero: v.clienteNumero!,
      destinoId: v.destinoId!,
      numeroPedidoVenta: normalizarComprobante(v.numeroPedidoVenta),
      observaciones: v.observaciones.trim() === "" ? null : v.observaciones.trim(),
      items: renglones.map((r) => ({ loteId: r.loteId, ubicacionId: r.ubicacionId, cantidad: r.cantidad })),
    };
    try {
      if (esAlta) await onCrear(input);
      else await onActualizar(orden.id, input);
      onClose();
    } catch (err) {
      setErrorMensaje(toAppError(err).message);
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <CopiaClientesAviso
        estado={copiaClientes}
        onActualizar={onActualizarClientes}
        actualizando={actualizandoClientes}
      />
      {loteDeClienteInactivo && (
        <p className="rounded-card border border-rojo/30 bg-rojo-bg px-3 py-2 text-sm text-rojo">
          El lote es de un cliente que no está activo en la copia de MacroGest: no se puede cargar en una orden.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="clienteNumero" label="Cliente" error={errors.clienteNumero?.message}>
          <Controller
            control={form.control}
            name="clienteNumero"
            render={({ field }) => (
              <ClienteSelect
                id="clienteNumero"
                clientes={clientes}
                value={field.value}
                onChange={(numero) => {
                  field.onChange(numero);
                  form.setValue("destinoId", null);
                  onClienteChange?.(numero);
                }}
              />
            )}
          />
        </Campo>
        <Campo id="destinoId" label="Destino" error={errors.destinoId?.message}>
          <Controller
            control={form.control}
            name="destinoId"
            render={({ field }) => (
              <DestinoSelect
                id="destinoId"
                destinos={destinos}
                value={field.value}
                onChange={field.onChange}
                onAgregar={onAgregarDestino}
                disabled={clienteNumero === null}
              />
            )}
          />
        </Campo>
        <Campo
          id="numeroPedidoVenta"
          label="Pedido de venta"
          error={errors.numeroPedidoVenta?.message}
          ayuda="Formato NN-NNNNN. No se verifica contra MacroGest en Fase 1."
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
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Renglones</p>

        {renglones.length === 0 ? (
          <p className="rounded-card border border-dashed border-line px-3 py-4 text-center text-sm text-ink-soft">
            Todavía no agregaste ningún lote.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line">
            {renglones.map((r) => {
              const filaRenglon = filaDe(r);
              const invalido = esInvalido(r);
              const excedido = excede(r);
              const cantidadInvalida = esCantidadInvalida(r);
              return (
                <li
                  key={`${r.loteId}-${r.ubicacionId}`}
                  className={cn(
                    "flex flex-wrap items-center gap-2 px-3 py-2 text-sm",
                    (invalido || cantidadInvalida) && "bg-rojo-bg",
                  )}
                >
                  <div className="min-w-40 flex-1">
                    {filaRenglon && <DescripcionLote fila={filaRenglon} />}
                    {invalido && <p className="text-xs font-medium text-rojo">Ya no corresponde al cliente elegido.</p>}
                    {!invalido && excedido && <p className="text-xs font-medium text-rojo">Supera lo disponible.</p>}
                    {!invalido && !excedido && cantidadInvalida && (
                      <p className="text-xs font-medium text-rojo">La cantidad tiene que ser mayor a 0.</p>
                    )}
                  </div>
                  <Input
                    aria-label={`Cantidad de ${filaRenglon?.loteCodigo} en ${filaRenglon?.ubicacion}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="w-24"
                    disabled={invalido}
                    value={r.cantidad}
                    onChange={(e) => cambiarCantidad(r.loteId, r.ubicacionId, Number(e.target.value))}
                  />
                  <span className="w-24 text-right text-ink-soft">
                    {filaRenglon ? kg(r.cantidad * filaRenglon.pesoUnitarioKg) : ""}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Quitar ${filaRenglon?.loteCodigo} en ${filaRenglon?.ubicacion}`}
                    onClick={() => quitarRenglon(r.loteId, r.ubicacionId)}
                  >
                    Quitar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <AgregarRenglon
          elegibles={elegibles}
          renglones={renglones}
          hayCliente={clienteNumero !== null}
          loteInicial={loteInicial}
          onAgregar={agregarRenglon}
        />

        <p data-testid="totales-orden" className="text-sm text-ink-soft">
          {unidades(totales.unidades)} unidades · {kg(totales.kgPropio)} propios · {kg(totales.kgCliente)} del cliente
        </p>
      </div>

      <Campo id="observaciones" label="Observaciones" error={errors.observaciones?.message}>
        <Textarea id="observaciones" rows={2} {...form.register("observaciones")} />
      </Campo>

      {errorMensaje && (
        <p role="alert" className="text-sm text-rojo">
          {errorMensaje}
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

/** Qué se carga en el renglón: el producto primero, después de dónde sale y de quién es (R2.3). */
function DescripcionLote({ fila }: { fila: StockFilaDto }) {
  return (
    <>
      <p className="font-medium text-ink">{productoEtiqueta(fila)}</p>
      <p className="text-xs text-ink-soft">{`Lote ${fila.loteCodigo} · ${fila.ubicacion} · ${duenioEtiqueta(fila)}`}</p>
      {fila.observaciones && (
        <p className="truncate text-xs text-ink-soft" title={fila.observaciones}>
          {fila.observaciones}
        </p>
      )}
    </>
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
