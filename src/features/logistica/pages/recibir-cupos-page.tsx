import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/shared/components/page-header";
import { AvisoDemo } from "../components/aviso-demo";
import { CatalogoSelect } from "../components/catalogo-select";
import { VentaPicker } from "../components/contrato-picker";
import { ElegidoPanel } from "../components/elegido-panel";
import { Campo, FormOperacionFooter } from "../components/form-operacion";
import { ahoraLocal, campania, fecha, hoy } from "../format";
import { confirmacionPendiente } from "../lib/comandos";
import { useDetalle, useOperacion } from "../queries/use-logistica";
import type { Recepcion, Solicitud, Venta } from "../types";

interface Fila {
  ordinal: number;
  fechaCarga: string;
  destinoCodigo: number;
  codigoTerminal: string;
  circuito: "directa" | "propia";
  lugarTipo: "campo" | "planta" | "otro";
  lugarReferencia: string;
}
interface Valores {
  referencia: string;
  recibidoAl: string;
  filas: Fila[];
}
function nuevaFila(ordinal: number, solicitud?: Solicitud | null): Fila {
  return {
    ordinal,
    fechaCarga: solicitud?.fechaSolicitada ?? hoy(),
    destinoCodigo: solicitud?.destinoCodigo ?? 0,
    codigoTerminal: "",
    circuito: "directa",
    lugarTipo: "campo",
    lugarReferencia: "",
  };
}

/**
 * Recibir cupos de terminal, como pantalla propia y no como modal.
 *
 * La grilla de filas tiene ocho columnas con selects adentro: en un modal quedaba con su propio
 * scroll horizontal, abajo de otra grilla con el suyo. Acá usa el ancho de la pantalla.
 *
 * Con `?solicitud=<id>` el contrato ya viene dado por esa solicitud y no se elige nada; sin el
 * parámetro, se elige un contrato de venta en la grilla del final.
 */
export function RecibirCuposPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const solicitudId = params.get("solicitud");
  const solicitudQuery = useDetalle<Solicitud>(
    `solicitudes-terminal/${solicitudId}`,
    {},
    solicitudId != null,
  );
  const solicitud = solicitudQuery.data ?? null;
  const [venta, setVenta] = useState<Venta | null>(null);
  const [resultado, setResultado] = useState<Recepcion | null>(null);
  const mutation = useOperacion<Recepcion>("cupos/recepciones");
  const bloqueado = mutation.isPending || confirmacionPendiente(mutation.error);
  const form = useForm<Valores>({
    defaultValues: { referencia: "", recibidoAl: ahoraLocal(), filas: [nuevaFila(1)] },
  });
  const filas = useFieldArray({ control: form.control, name: "filas" });
  const valores = useWatch({ control: form.control });
  const contratoVenta = solicitud?.contratoVenta ?? venta?.numero;
  // La solicitud llega por HTTP, después del primer render: recién ahí se puede proponer su fecha y
  // su destino en las filas que todavía están vacías. Como prop del modal venía desde el arranque.
  const destinoSolicitud = solicitud?.destinoCodigo;
  const fechaSolicitud = solicitud?.fechaSolicitada;
  useEffect(() => {
    if (!destinoSolicitud) return;
    form.getValues("filas").forEach((f, i) => {
      if (f.destinoCodigo) return;
      form.setValue(`filas.${i}.destinoCodigo`, destinoSolicitud);
      // La fecha sólo si sigue en el valor por defecto: no pisar una que ya tocaron.
      if (fechaSolicitud && f.fechaCarga === hoy())
        form.setValue(`filas.${i}.fechaCarga`, fechaSolicitud);
    });
  }, [destinoSolicitud, fechaSolicitud, form]);
  const volver = () => {
    if (!bloqueado) void navigate("/logistica/cupos");
  };

  if (resultado) {
    return (
      <>
        <PageHeader
          title="Recepción guardada"
          subtitle={`Se recibieron ${resultado.cupos.length} cupos y se creó su seguimiento.`}
          actions={
            <Button
              onClick={() =>
                void navigate("/logistica/cupos", { state: { tab: "recibidos" } })
              }
            >
              Ver cupos recibidos
            </Button>
          }
        />
        {resultado.advertencias.map((a) => (
          <p
            key={a}
            className="mb-2 rounded-md border border-clementina-deep/40 bg-clementina/10 p-3 text-sm"
          >
            {a}
          </p>
        ))}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Recibir cupos de terminal"
        subtitle="Una fila por cupo, con su propia fecha de carga y destino. El código lo informa la terminal."
        actions={
          <Button variant="outline" type="button" disabled={bloqueado} onClick={volver}>
            <ArrowLeft className="size-4" aria-hidden /> Volver a Cupos
          </Button>
        }
      />
      <AvisoDemo />

      <ElegidoPanel
        titulo={solicitudId ? "Solicitud elegida" : "Contrato elegido"}
        vacio={
          solicitudId
            ? solicitudQuery.isLoading
              ? "Buscando la solicitud…"
              : "No se encontró la solicitud. Volvé a Cupos y elegí Recibir en su fila."
            : "Todavía no elegiste contrato. Buscalo en la grilla de abajo y marcá su casillero."
        }
        datos={
          solicitud
            ? [
                { rotulo: "Contrato", valor: solicitud.contratoVenta },
                {
                  rotulo: "Cereal / campaña",
                  valor: `${solicitud.productoNombre ?? solicitud.producto} / ${solicitud.campania}`,
                },
                { rotulo: "Cupos solicitados", valor: String(solicitud.cantidadCupos) },
                { rotulo: "Fecha solicitada", valor: fecha(solicitud.fechaSolicitada) },
              ]
            : venta && [
                { rotulo: "Contrato", valor: venta.numero },
                { rotulo: "Comprador", valor: venta.compradorNombre ?? "Sin nombre" },
                {
                  rotulo: "Cereal / campaña",
                  valor: `${venta.productoNombre ?? venta.producto ?? "Sin cereal"} / ${campania(venta.campania)}`,
                },
                {
                  rotulo: "Destino del contrato",
                  valor: venta.destinoNombre ?? `Código ${venta.destinoCodigo ?? "sin dato"}`,
                },
              ]
        }
      />

      <form
        className="mt-4"
        onSubmit={form.handleSubmit(async (v) => {
          if (!contratoVenta || v.filas.some((f) => !f.destinoCodigo)) {
            form.setError("root", {
              message: contratoVenta
                ? "Completá el destino de cada fila."
                : "Elegí un contrato de venta en la grilla de abajo.",
            });
            return;
          }
          try {
            setResultado(
              await mutation.mutateAsync({
                contratoVenta,
                solicitudId: solicitud?.id ?? null,
                referencia: v.referencia,
                recibidoAl: new Date(v.recibidoAl).toISOString(),
                filas: v.filas.map((f) => ({
                  ...f,
                  codigoTerminal: f.codigoTerminal.trim() || null,
                  lugarReferencia: f.lugarReferencia.trim() || null,
                })),
              }),
            );
          } catch {
            /* El reintento conserva clave y cuerpo; el error se muestra en el pie. */
          }
        })}
      >
        <fieldset disabled={bloqueado || !contratoVenta} className="min-w-0 space-y-4">
          <legend className="sr-only">Datos de la recepción</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
            <Campo titulo="Referencia de recepción">
              <Input
                maxLength={200}
                {...form.register("referencia", {
                  required: true,
                  maxLength: 200,
                  validate: (s) => s.trim().length > 0,
                })}
              />
            </Campo>
            <Campo titulo="Fecha y hora de recepción">
              <Input type="datetime-local" {...form.register("recibidoAl", { required: true })} />
            </Campo>
          </div>
          <div className="overflow-x-auto rounded-card border border-line bg-panel shadow-card">
            <table className="w-full min-w-[980px] text-left text-sm">
              <caption className="sr-only">Filas de recepción</caption>
              <thead className="border-b border-line bg-panel-soft text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  {[
                    "Fila",
                    "Fecha de carga",
                    "Destino",
                    "Código terminal (opcional)",
                    "Circuito",
                    "Lugar",
                    "Referencia del lugar",
                    "Acción",
                  ].map((c) => (
                    <th scope="col" key={c} className="px-2 py-2.5 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filas.fields.map((f, i) => (
                  <tr key={f.id}>
                    <td className="p-2">{f.ordinal}</td>
                    <td className="p-2">
                      <Input
                        aria-label={`Fecha de carga fila ${f.ordinal}`}
                        type="date"
                        {...form.register(`filas.${i}.fechaCarga`, { required: true })}
                      />
                    </td>
                    <td className="min-w-56 p-2">
                      <CatalogoSelect
                        tipo="destinos"
                        titulo={`Destino fila ${f.ordinal}`}
                        value={valores.filas?.[i]?.destinoCodigo ?? 0}
                        onChange={(codigo) =>
                          form.setValue(`filas.${i}.destinoCodigo`, codigo, {
                            shouldValidate: true,
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        aria-label={`Código terminal fila ${f.ordinal}`}
                        maxLength={50}
                        {...form.register(`filas.${i}.codigoTerminal`)}
                      />
                    </td>
                    <td className="p-2">
                      <select
                        aria-label={`Circuito fila ${f.ordinal}`}
                        className="h-10 rounded-md border border-line bg-panel px-2"
                        {...form.register(`filas.${i}.circuito`)}
                      >
                        <option value="directa">Directa</option>
                        <option value="propia">Propia</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        aria-label={`Lugar fila ${f.ordinal}`}
                        className="h-10 rounded-md border border-line bg-panel px-2"
                        {...form.register(`filas.${i}.lugarTipo`)}
                      >
                        <option value="campo">Campo</option>
                        <option value="planta">Planta</option>
                        <option value="otro">Otro</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <Input
                        aria-label={`Referencia del lugar fila ${f.ordinal}`}
                        maxLength={200}
                        {...form.register(`filas.${i}.lugarReferencia`)}
                      />
                    </td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Quitar fila ${f.ordinal}`}
                        disabled={filas.fields.length === 1}
                        onClick={() => filas.remove(i)}
                      >
                        Quitar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={filas.fields.length >= 200}
            onClick={() =>
              filas.append(nuevaFila(Math.max(...filas.fields.map((f) => f.ordinal)) + 1, solicitud))
            }
          >
            Agregar fila
          </Button>
          <p className="text-xs text-ink-soft">
            El código lo informa la terminal. Si todavía no llegó, dejalo vacío. Patente, CTG y kilos
            administrativos se consultan en MacroGest.
          </p>
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
          texto="Guardar recepción completa"
        />
      </form>

      {!solicitudId && (
        <>
          <h2 className="mb-2 mt-6 font-display text-xl text-ink">Contratos de venta</h2>
          <p className="mb-2 text-xs text-ink-soft">
            MacroGest · el cupo recibido se aplica siempre a un contrato de venta.
          </p>
          <fieldset disabled={bloqueado} className="min-w-0">
            <VentaPicker
              selected={venta}
              onSelect={(v) => {
                setVenta(v);
                form.clearErrors("root");
                // El destino del contrato es el que propone cada fila que todavía no tiene uno.
                filas.fields.forEach((_, i) => {
                  if (!form.getValues(`filas.${i}.destinoCodigo`))
                    form.setValue(`filas.${i}.destinoCodigo`, v.destinoCodigo ?? 0);
                });
              }}
            />
          </fieldset>
        </>
      )}
    </>
  );
}
