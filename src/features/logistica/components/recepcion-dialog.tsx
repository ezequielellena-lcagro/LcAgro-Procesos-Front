import { confirmacionPendiente } from "../lib/comandos";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { hoy, ahoraLocal } from "../format";
import { useOperacion } from "../queries/use-logistica";
import type { Recepcion, Solicitud, Venta } from "../types";
import { CatalogoSelect } from "./catalogo-select";
import { VentaPicker } from "./contrato-picker";
import { Campo, FormOperacionFooter } from "./form-operacion";
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
function nuevaFila(ordinal: number, solicitud?: Solicitud): Fila {
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
export function RecepcionDialog({
  solicitud,
  onClose,
}: {
  solicitud?: Solicitud;
  onClose: () => void;
}) {
  const [venta, setVenta] = useState<Venta | null>(null);
  const [resultado, setResultado] = useState<Recepcion | null>(null);
  const mutation = useOperacion<Recepcion>("cupos/recepciones");
  const form = useForm<Valores>({
    defaultValues: { referencia: "", recibidoAl: ahoraLocal(), filas: [nuevaFila(1, solicitud)] },
  });
  const filas = useFieldArray({ control: form.control, name: "filas" });
  const valores = useWatch({ control: form.control });
  const cerrar = () => {
    if (!mutation.isPending && !confirmacionPendiente(mutation.error)) onClose();
  };
  return (
    <Modal open title="Recibir cupos de terminal" onClose={cerrar} className="max-w-6xl">
      {resultado ? (
        <div className="min-w-0 space-y-4">
          <p role="status">
            Se recibieron {resultado.cupos.length} cupos y se creó su seguimiento.
          </p>
          {resultado.advertencias.map((a) => (
            <p
              key={a}
              className="rounded-md border border-clementina-deep/40 bg-clementina/10 p-3 text-sm"
            >
              {a}
            </p>
          ))}
          <Button onClick={onClose}>Ver cupos recibidos</Button>
        </div>
      ) : (
        <>
          {solicitud ? (
            <p className="mb-4 text-sm">
              Solicitud del contrato {solicitud.contratoVenta}. Cada fila conserva su propia fecha y
              destino.
            </p>
          ) : (
            <fieldset disabled={mutation.isPending || confirmacionPendiente(mutation.error)}>
              <VentaPicker selected={venta} onSelect={setVenta} />
            </fieldset>
          )}
          <form
            className="mt-4"
            onSubmit={form.handleSubmit(async (v) => {
              const contratoVenta = solicitud?.contratoVenta ?? venta?.numero;
              if (!contratoVenta || v.filas.some((f) => !f.destinoCodigo)) {
                form.setError("root", { message: "Elegí contrato y destino de cada fila." });
                return;
              }
              try {
                const respuesta = await mutation.mutateAsync({
                  contratoVenta,
                  solicitudId: solicitud?.id ?? null,
                  referencia: v.referencia,
                  recibidoAl: new Date(v.recibidoAl).toISOString(),
                  filas: v.filas.map((f) => ({
                    ...f,
                    codigoTerminal: f.codigoTerminal.trim() || null,
                    lugarReferencia: f.lugarReferencia.trim() || null,
                  })),
                });
                setResultado(respuesta);
              } catch {
                /* Reintento conserva clave y cuerpo. */
              }
            })}
          >
            <fieldset
              disabled={mutation.isPending || confirmacionPendiente(mutation.error)}
              className="min-w-0 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
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
                  <Input
                    type="datetime-local"
                    {...form.register("recibidoAl", { required: true })}
                  />
                </Campo>
              </div>
              <div className="overflow-x-auto rounded-card border border-line">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <caption className="sr-only">Filas de recepción</caption>
                  <thead className="bg-secondary text-xs text-ink-soft">
                    <tr>
                      {[
                        "Fila",
                        "Carga",
                        "Destino",
                        "Código terminal (opcional)",
                        "Circuito",
                        "Lugar",
                        "Referencia del lugar",
                        "Acción",
                      ].map((c) => (
                        <th scope="col" key={c} className="px-2 py-3 font-medium">
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
                            disabled={filas.fields.length === 1}
                            onClick={() => filas.remove(i)}
                          >
                            Quitar fila {f.ordinal}
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
                  filas.append(
                    nuevaFila(Math.max(...filas.fields.map((f) => f.ordinal)) + 1, solicitud),
                  )
                }
              >
                Agregar fila
              </Button>
              <p className="text-xs text-ink-soft">
                El código lo informa la terminal. Si todavía no llegó, dejalo vacío. Patente, CTG y
                kilos administrativos se consultan en MacroGest.
              </p>
            </fieldset>
            <FormOperacionFooter
              error={mutation.error}
              invalid={Object.keys(form.formState.errors).length > 0}
              pending={mutation.isPending}
              onClose={cerrar}
              texto="Guardar recepción completa"
            />
          </form>
        </>
      )}
    </Modal>
  );
}
