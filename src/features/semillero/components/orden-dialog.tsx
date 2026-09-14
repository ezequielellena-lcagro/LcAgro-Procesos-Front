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
import { cn } from "@/lib/utils";
import { kg, unidades } from "../format";
import { normalizarComprobante } from "../lib/comprobante";
import {
  excedidos,
  lotesElegibles,
  renglonesDeOtroCliente,
  totalesOrden,
  type LoteElegible,
  type RenglonEditable,
} from "../lib/orden";
import type {
  ClienteCopiaDto,
  DestinoDto,
  DuenioLote,
  EstadoCopiaClientesDto,
  OrdenCargaDto,
  OrdenCargaInput,
  StockFilaDto,
} from "../types";
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

function aValues(orden: OrdenCargaDto | null): Values {
  if (!orden) {
    return { clienteNumero: null, destinoId: null, numeroPedidoVenta: "", observaciones: "" };
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

const mismaClave = (a: { loteId: number; ubicacionId: number }, b: { loteId: number; ubicacionId: number }) =>
  a.loteId === b.loteId && a.ubicacionId === b.ubicacionId;

function duenioEtiqueta(f: { duenio: DuenioLote; clienteDenominacion: string | null }): string {
  return f.duenio === "Propio" ? "Propio" : `Cliente · ${f.clienteDenominacion}`;
}

interface Props {
  open: boolean;
  /** `null` = alta. */
  orden: OrdenCargaDto | null;
  clientes: ClienteCopiaDto[];
  copiaClientes: EstadoCopiaClientesDto;
  actualizandoClientes: boolean;
  onActualizarClientes: () => void;
  filas: StockFilaDto[];
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
  const [nuevaClave, setNuevaClave] = useState("");
  const [nuevaCantidad, setNuevaCantidad] = useState("");
  const [errorNuevoRenglon, setErrorNuevoRenglon] = useState<string | null>(null);

  const form = useForm<Values>({ resolver: zodResolver(esquema()), defaultValues: aValues(orden) });
  const { errors, isSubmitting } = form.formState;

  // `useWatch`, no `form.watch()`: el compilador de React no puede memoizar `watch`, y acá hace falta
  // releer el cliente y el destino en cada cambio (mismo patrón que `duenioElegido` en `lote-dialog.tsx`).
  const clienteNumero = useWatch({ control: form.control, name: "clienteNumero" });

  const elegibles: LoteElegible[] = lotesElegibles(filas, reservaOriginal, clienteNumero ?? undefined);
  const invalidos = renglonesDeOtroCliente(renglones, filas, clienteNumero ?? undefined);
  const excedidosActuales = excedidos(renglones, elegibles);
  const cantidadesInvalidas = renglones.filter((r) => !(r.cantidad > 0));
  const totales = totalesOrden(renglones, filas);

  const yaAgregado = (loteId: number, ubicacionId: number) =>
    renglones.some((r) => mismaClave(r, { loteId, ubicacionId }));
  const opcionesAgregar = elegibles.filter((e) => !yaAgregado(e.loteId, e.ubicacionId));

  const filaDe = (r: RenglonEditable) => filas.find((f) => mismaClave(f, r));
  const esInvalido = (r: RenglonEditable) => invalidos.some((i) => mismaClave(i, r));
  const excede = (r: RenglonEditable) => excedidosActuales.some((e) => mismaClave(e, r));
  const esCantidadInvalida = (r: RenglonEditable) => cantidadesInvalidas.some((c) => mismaClave(c, r));

  const agregarRenglon = () => {
    setErrorNuevoRenglon(null);
    const [loteIdTxt, ubicacionIdTxt] = nuevaClave.split(":");
    const elegible = opcionesAgregar.find(
      (e) => e.loteId === Number(loteIdTxt) && e.ubicacionId === Number(ubicacionIdTxt),
    );
    if (!elegible) {
      setErrorNuevoRenglon("Elegí un lote y una ubicación.");
      return;
    }
    const cantidad = Number(nuevaCantidad);
    if (nuevaCantidad.trim() === "" || Number.isNaN(cantidad) || cantidad <= 0) {
      setErrorNuevoRenglon("La cantidad tiene que ser mayor a 0.");
      return;
    }
    if (cantidad > elegible.maximo) {
      setErrorNuevoRenglon(`Hay ${unidades(elegible.maximo)} disponibles para ese lote y ubicación.`);
      return;
    }
    setRenglones((r) => [...r, { loteId: elegible.loteId, ubicacionId: elegible.ubicacionId, cantidad }]);
    setNuevaClave("");
    setNuevaCantidad("");
  };

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
            placeholder="06-00045"
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
                    <p className="font-medium text-ink">
                      {filaRenglon?.loteCodigo} · {filaRenglon?.ubicacion}
                    </p>
                    <p className="text-xs text-ink-soft">{filaRenglon ? duenioEtiqueta(filaRenglon) : ""}</p>
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

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor="nuevoRenglon">Agregar renglón</Label>
            <Select id="nuevoRenglon" value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)}>
              <option value="">Elegí un lote y una ubicación…</option>
              {opcionesAgregar.map((e) => (
                <option key={`${e.loteId}-${e.ubicacionId}`} value={`${e.loteId}:${e.ubicacionId}`}>
                  {e.loteCodigo} · {e.ubicacion} · {duenioEtiqueta(e)}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-28 space-y-1">
            <Label htmlFor="nuevaCantidad">Cantidad</Label>
            <Input
              id="nuevaCantidad"
              type="number"
              min="0.01"
              step="0.01"
              value={nuevaCantidad}
              onChange={(e) => setNuevaCantidad(e.target.value)}
            />
          </div>
          <Button type="button" variant="outline" onClick={agregarRenglon}>
            Agregar
          </Button>
        </div>
        {errorNuevoRenglon && <p className="text-xs text-rojo">{errorNuevoRenglon}</p>}

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
