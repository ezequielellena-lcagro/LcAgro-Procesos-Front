import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FilterActions, FilterField } from "@/shared/components/filter-bar";
import { uuid } from "@/lib/uuid";
import { fecha, hoy, kg, periodoInicial, sumarDias } from "../format";
import { cursorPropio, useListado } from "../queries/use-logistica";
import type { Cupo, OtorgarBody, Pedido, Preventa } from "../types";
import { CampaniaSelect } from "./campania-select";
import { CatalogoSelect } from "./catalogo-select";
import { ColaPrioridad } from "./cola-prioridad";
import { Elegir } from "./elegir";
import { PreventaPicker } from "./contrato-picker";
import { OtorgamientoDialog, type RevisionOtorgamiento } from "./otorgamiento-dialog";
import { PeriodoFiltro } from "./periodo-filtro";
import { TablaLogistica } from "./tabla-logistica";

type Modo = "pedido" | "cliente" | "propio";
const filtrosVacios = {
  clienteNumero: 0,
  producto: 0,
  campania: "",
  destinoCodigo: 0,
  circuito: "",
};
function compatible(
  a: { producto: number; campania: string },
  b: { producto: number; campania: string },
) {
  return a.producto === b.producto && a.campania === b.campania;
}
function avisos(cupos: Cupo[], pedido: Pedido | null) {
  const resultado: string[] = [];
  if (cupos.some((c) => !c.codigoTerminal))
    resultado.push("Hay cupos con código terminal pendiente de informar.");
  if (cupos.some((c) => c.fechaCarga < hoy()))
    resultado.push("Hay cupos con fecha de carga pasada.");
  if (new Set(cupos.map((c) => c.fechaCarga)).size > 1)
    resultado.push("Las fechas de carga son distintas.");
  if (pedido && cupos.some((c) => c.fechaCarga !== pedido.fechaSolicitada))
    resultado.push("Hay cupos con fecha de carga distinta a la fecha solicitada del pedido.");
  if (new Set(cupos.map((c) => c.destinoCodigo)).size > 1)
    resultado.push("Los destinos son distintos.");
  return resultado;
}

export function OtorgarPanel({
  gestionar,
  inicial,
  onLockChange,
}: {
  gestionar: boolean;
  inicial?: Cupo | null;
  onLockChange: (locked: boolean) => void;
}) {
  const [periodo, setPeriodo] = useState(() =>
    inicial
      ? { desde: inicial.fechaCarga, hastaExclusivo: sumarDias(inicial.fechaCarga, 1) }
      : periodoInicial(),
  );
  const [borrador, setBorrador] = useState(filtrosVacios);
  const [filtros, setFiltros] = useState(filtrosVacios);
  const [modo, setModo] = useState<Modo>("pedido");
  const [seleccion, setSeleccion] = useState<Cupo[]>(() =>
    inicial?.disponibleParaOtorgar && gestionar ? [inicial] : [],
  );
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cliente, setCliente] = useState(0);
  const [clienteNombre, setClienteNombre] = useState<string | null>(null);
  const [preventa, setPreventa] = useState<Preventa | null>(null);
  const [conPreventa, setConPreventa] = useState(false);
  const [revision, setRevision] = useState<RevisionOtorgamiento | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [advertencias, setAdvertencias] = useState<string[]>([]);
  const [consultaId] = useState(() => uuid());
  const [paginaVersion, setPaginaVersion] = useState(0);
  const paginaContexto = { otorgar: consultaId, version: paginaVersion };
  const reiniciarPaginas = () => setPaginaVersion((version) => version + 1);
  const comunes = {
    ...periodo,
    producto: filtros.producto || undefined,
    campania: filtros.campania || undefined,
  };
  const disponibles = useListado<Cupo>(
    "cupos",
    {
      ...comunes,
      destinoCodigo: filtros.destinoCodigo || undefined,
      circuito: filtros.circuito || undefined,
      soloDisponibles: true,
    },
    (f) => ({ despuesFecha: f.fechaCarga, despuesId: f.id }),
    true,
    paginaContexto,
  );
  const pendientes = useListado<Pedido>(
    "pedidos",
    { ...comunes, clienteNumero: filtros.clienteNumero || undefined, soloPendientes: true },
    cursorPropio,
    true,
    paginaContexto,
  );
  const grupo = seleccion[0];
  const limite = modo === "pedido" && pedido ? Math.min(200, pedido.pendientes) : 200;
  /** Por qué un cupo disponible no se puede sumar a esta selección. */
  const motivoCupo = (f: Cupo): string | null => {
    if (!f.disponibleParaOtorgar) return "Ya asignado o no disponible";
    if (grupo != null && !compatible(f, grupo)) return "Otro cereal o campaña que los elegidos";
    if (modo === "pedido" && pedido != null && !compatible(f, pedido))
      return "No coincide con el cereal o campaña del pedido";
    if (seleccion.length >= limite)
      return modo === "pedido" && pedido
        ? `Ya cubriste los ${limite} pendientes del pedido`
        : `Máximo ${limite} cupos por operación`;
    return null;
  };
  const valido =
    seleccion.length > 0 &&
    seleccion.length <= limite &&
    seleccion.every((c) => c.disponibleParaOtorgar && compatible(c, grupo)) &&
    (modo === "propio" ||
      (modo === "pedido"
        ? pedido != null && compatible(grupo, pedido)
        : cliente > 0 &&
          (!conPreventa ||
            (preventa != null &&
              preventa.clienteNumero === cliente &&
              preventa.producto === grupo.producto &&
              preventa.campania === Number(grupo.campania.replace("-", ""))))));
  const limpiar = () => {
    reiniciarPaginas();
    setSeleccion([]);
    setPedido(null);
    setPreventa(null);
    setMensaje("");
    setAdvertencias([]);
  };
  const cerrarRevision = () => {
    setRevision(null);
    onLockChange(false);
  };
  const campaniaValida =
    !borrador.campania ||
    (/^\d{4}-\d{4}$/.test(borrador.campania) &&
      Number(borrador.campania.slice(5)) === Number(borrador.campania.slice(0, 4)) + 1);
  return (
    <div className="min-w-0 space-y-4">
      <p className="text-sm text-ink-soft">
        Compará cupos disponibles por fecha de carga con pedidos pendientes por fecha solicitada. El
        orden de las filas es por fecha; no indica prioridad comercial.
      </p>
      <fieldset disabled={revision != null} className="min-w-0">
        {/* Fechas y filtros en la MISMA barra: acotan las dos tablas de abajo a la vez. */}
        <PeriodoFiltro
          value={periodo}
          etiqueta="Rango de fechas de ambas tablas"
          onChange={(p) => {
            setPeriodo(p);
            limpiar();
          }}
          onSubmit={(e) => {
            e.preventDefault();
            if (campaniaValida) {
              setFiltros({ ...borrador, campania: borrador.campania.trim() });
              limpiar();
            }
          }}
        >
          <CatalogoSelect
            className="w-56"
            tipo="clientes"
            titulo="Productor de los pedidos"
            value={borrador.clienteNumero}
            required={false}
            modoFiltro
            onChange={(clienteNumero) => setBorrador({ ...borrador, clienteNumero })}
          />
          <CatalogoSelect
            className="w-56"
            tipo="productos"
            titulo="Cereal"
            value={borrador.producto}
            required={false}
            modoFiltro
            onChange={(producto) => setBorrador({ ...borrador, producto })}
          />
          <CampaniaSelect
            value={borrador.campania}
            onChange={(campania) => setBorrador({ ...borrador, campania })}
          />
          <CatalogoSelect
            className="w-56"
            tipo="destinos"
            titulo="Destino de los cupos"
            value={borrador.destinoCodigo}
            required={false}
            modoFiltro
            onChange={(destinoCodigo) => setBorrador({ ...borrador, destinoCodigo })}
          />
          <FilterField label="Circuito de los cupos">
            <Select
              className="w-40"
              value={borrador.circuito}
              onChange={(e) => setBorrador({ ...borrador, circuito: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="directa">Directa</option>
              <option value="propia">Propia</option>
            </Select>
          </FilterField>
          <FilterActions
            aplicarDeshabilitado={!campaniaValida}
            onClear={() => {
              setBorrador(filtrosVacios);
              setFiltros(filtrosVacios);
              limpiar();
            }}
            aviso={
              !campaniaValida && (
                <p role="alert" className="mr-auto text-sm text-rojo">
                  Ingresá una campaña como 2025-2026.
                </p>
              )
            }
          />
        </PeriodoFiltro>
      </fieldset>
      {gestionar && (
        <fieldset
          disabled={revision != null}
          className="flex min-w-0 flex-wrap gap-5 border-y border-line py-3"
        >
          <legend className="sr-only">Destinatario</legend>
          {(
            [
              ["pedido", "Pedido"],
              ["cliente", "Cliente sin pedido"],
              ["propio", "Propio"],
            ] as const
          ).map(([valor, texto]) => (
            <label key={valor} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                className="size-4 accent-primary"
                name="destinatario"
                checked={modo === valor}
                onChange={() => {
                  setModo(valor);
                  reiniciarPaginas();
                  setPedido(null);
                  setCliente(0);
                  setClienteNombre(null);
                  setPreventa(null);
                  setConPreventa(false);
                  setMensaje("");
                }}
              />
              {texto}
            </label>
          ))}
        </fieldset>
      )}
      {mensaje && (
        <p role="status" className="rounded-md border border-line bg-panel p-3 text-sm">
          {mensaje}
        </p>
      )}
      {advertencias.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-ink-soft">
          {advertencias.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <div className="@container min-w-0">
        <fieldset
          disabled={revision != null}
          className="grid min-w-0 gap-5 @min-[1440px]:grid-cols-2"
        >
          <div className="min-w-0 space-y-2">
            <h2 className="font-display text-xl text-ink">Cupos disponibles</h2>
            <p className="text-xs text-ink-soft">
              Fecha de carga · filas consultadas, con paginación independiente.
            </p>
            <TablaLogistica
              titulo="Cupos disponibles para otorgar"
              filas={disponibles.data?.pages.flatMap((p) => p.filas) ?? []}
              clave={(f) => f.id}
              elegida={(f) => seleccion.some((c) => c.id === f.id)}
              cargando={disponibles.isLoading}
              error={disponibles.error}
              reintentar={() => void disponibles.refetch()}
              hayMas={disponibles.hasNextPage}
              mas={() => void disponibles.fetchNextPage()}
              cargandoMas={disponibles.isFetchingNextPage}
              vacio="No hay cupos disponibles para estas fechas y filtros."
              columnas={[
                ...(gestionar
                  ? [
                      {
                        titulo: "Elegir",
                        celda: (f: Cupo) => {
                          const elegido = seleccion.some((c) => c.id === f.id);
                          return (
                            <Elegir
                              tipo="checkbox"
                              etiqueta={`Elegir cupo ${f.contratoVenta} fila ${f.ordinal}`}
                              checked={elegido}
                              motivo={motivoCupo(f)}
                              onChange={() => {
                                setSeleccion((actual) => {
                                  if (actual.some((c) => c.id === f.id))
                                    return actual.filter((c) => c.id !== f.id);
                                  if (
                                    !f.disponibleParaOtorgar ||
                                    actual.length >= limite ||
                                    (actual[0] && !compatible(f, actual[0]))
                                  )
                                    return actual;
                                  return [...actual, structuredClone(f)];
                                });
                                setPreventa(null);
                                setMensaje("");
                              }}
                            />
                          );
                        },
                      },
                    ]
                  : []),
                { titulo: "Contrato", celda: (f) => f.contratoVenta },
                {
                  titulo: "Código terminal",
                  celda: (f) => f.codigoTerminal || "Pendiente de informar",
                },
                { titulo: "Destino", celda: (f) => f.destinoNombre ?? f.destinoCodigo },
                { titulo: "Fecha de carga", celda: (f) => fecha(f.fechaCarga) },
                {
                  titulo: "Cereal / campaña",
                  celda: (f) => `${f.productoNombre ?? f.producto} / ${f.campania}`,
                },
                { titulo: "Circuito", celda: (f) => f.circuito },
              ]}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <h2 className="font-display text-xl text-ink">Pedidos pendientes</h2>
            <p className="text-xs text-ink-soft">
              Fecha solicitada · cantidades del pedido, no totales de la consulta.
            </p>
            <TablaLogistica
              titulo="Pedidos pendientes de otorgamiento"
              filas={pendientes.data?.pages.flatMap((p) => p.filas) ?? []}
              clave={(f) => f.id}
              elegida={(f) => pedido?.id === f.id}
              cargando={pendientes.isLoading}
              error={pendientes.error}
              reintentar={() => void pendientes.refetch()}
              hayMas={pendientes.hasNextPage}
              mas={() => void pendientes.fetchNextPage()}
              cargandoMas={pendientes.isFetchingNextPage}
              vacio="No hay pedidos pendientes para estas fechas y filtros."
              columnas={[
                ...(gestionar && modo === "pedido"
                  ? [
                      {
                        titulo: "Elegir",
                        celda: (f: Pedido) => (
                          <Elegir
                            tipo="radio"
                            name="pedido-otorgar"
                            etiqueta={`Elegir pedido de ${f.clienteNombre ?? `Cliente ${f.clienteNumero}`}`}
                            checked={pedido?.id === f.id}
                            motivo={f.pendientes < 1 ? "Sin cupos pendientes" : null}
                            onChange={() => {
                              reiniciarPaginas();
                              setPedido(structuredClone(f));
                              if (
                                seleccion.some((c) => !compatible(c, f)) ||
                                seleccion.length > f.pendientes
                              ) {
                                setSeleccion([]);
                                setMensaje(
                                  "La selección no coincide con el cereal, campaña o demanda del pedido. Elegí los cupos compatibles.",
                                );
                              }
                            }}
                          />
                        ),
                      },
                    ]
                  : []),
                {
                  titulo: "Productor",
                  celda: (f) => (
                    <span>
                      {f.clienteNombre ?? `Cliente ${f.clienteNumero}`}
                      <span className="block text-xs text-ink-soft">Cliente {f.clienteNumero}</span>
                    </span>
                  ),
                },
                {
                  titulo: "Preventa",
                  celda: (f) =>
                    f.preventa ? `${f.preventa.operacion} ${f.preventa.numero}` : "Sin preventa",
                },
                {
                  titulo: "Cereal / campaña",
                  celda: (f) => `${f.productoNombre ?? f.producto} / ${f.campania}`,
                },
                { titulo: "Fecha solicitada", celda: (f) => fecha(f.fechaSolicitada) },
                { titulo: "Cupos pedidos", numero: true, celda: (f) => f.cantidadCupos },
                { titulo: "Otorgados", numero: true, celda: (f) => f.otorgados },
                { titulo: "Pendientes", numero: true, celda: (f) => f.pendientes },
              ]}
            />
          </div>
        </fieldset>
      </div>
      {/* A quién le toca: el orden que el área usuaria ya usaba en su planilla. Va DEBAJO de los
          cupos para que se lea "tengo esto · a quién se lo doy", que es como lo cuentan ellos. */}
      <ColaPrioridad
        campania={
          /^\d{4}-\d{4}$/.test(filtros.campania) ? Number(filtros.campania.replace("-", "")) : null
        }
        producto={filtros.producto || undefined}
        activo
      />
      {gestionar && modo === "cliente" && (
        <fieldset disabled={revision != null} className="min-w-0 space-y-4">
          <div className="max-w-lg">
            <CatalogoSelect
              tipo="clientes"
              titulo="Productor destinatario"
              value={cliente}
              onChange={(v, ref) => {
                setCliente(v);
                reiniciarPaginas();
                setClienteNombre(ref?.nombre ?? null);
                setPreventa(null);
              }}
            />
          </div>
          <label className="block text-sm">
            <input
              type="checkbox"
              checked={conPreventa}
              onChange={(e) => {
                setConPreventa(e.target.checked);
                setPreventa(null);
              }}
            />{" "}
            Asociar una preventa (opcional)
          </label>
          {conPreventa &&
            (cliente > 0 && grupo ? (
              <PreventaPicker
                key={`${cliente}/${grupo.producto}/${grupo.campania}`}
                selected={preventa}
                paginaContexto={paginaContexto}
                onSelect={setPreventa}
                filtros={{
                  clienteNumero: cliente,
                  producto: grupo.producto,
                  campania: Number(grupo.campania.replace("-", "")),
                }}
              />
            ) : (
              <p className="text-sm text-ink-soft">
                Elegí un cliente y al menos un cupo para consultar sus preventas de ese cereal y
                campaña.
              </p>
            ))}
        </fieldset>
      )}
      {gestionar && (
        <div className="space-y-3 border-t border-line pt-4">
          <p className="text-sm">
            <strong>{seleccion.length} cupos seleccionados</strong> · {kg(seleccion.length * 30000)}{" "}
            estimados. Máximo {limite} cupos
            {modo === "pedido" && pedido ? " según los pendientes del pedido" : " por operación"}.
          </p>
          <p className="text-xs text-ink-soft">
            Seleccioná un solo cereal y campaña. La estimación usa 30.000 kg por cupo y no
            representa peso real ni saldo comercial.
          </p>
          <Button
            disabled={!valido || revision != null}
            onClick={() => {
              const body: OtorgarBody = {
                destinatarioTipo: modo === "propio" ? "propio" : "cliente",
                cupos: seleccion.map((c) => ({ id: c.id, revision: c.revision })),
              };
              if (modo === "pedido" && pedido) {
                body.clienteNumero = pedido.clienteNumero;
                body.pedidoId = pedido.id;
                body.pedidoRevision = pedido.revision;
              }
              if (modo === "cliente") {
                body.clienteNumero = cliente;
                if (conPreventa && preventa)
                  body.preventa = { operacion: preventa.operacion, numero: preventa.numero };
              }
              const ref = modo === "pedido" ? pedido?.preventa : conPreventa ? preventa : null;
              setRevision({
                body,
                cupos: structuredClone(seleccion),
                pedido,
                destinatario:
                  modo === "propio"
                    ? "Propio"
                    : modo === "pedido"
                      ? `${pedido?.clienteNombre ?? `Cliente ${pedido?.clienteNumero}`} · Pedido`
                      : `${clienteNombre ?? `Cliente ${cliente}`} · Sin pedido`,
                preventa: ref ? `${ref.operacion} ${ref.numero}` : "Sin preventa",
                advertencias: avisos(seleccion, modo === "pedido" ? pedido : null),
              });
              onLockChange(true);
            }}
          >
            Revisar otorgamiento
          </Button>
        </div>
      )}
      {revision && (
        <OtorgamientoDialog
          revision={revision}
          onClose={cerrarRevision}
          onConflict={() => {
            cerrarRevision();
            limpiar();
            setMensaje(
              "Otro operador cambió los datos o la demanda disponible. Actualizamos las tablas; elegí nuevamente con los datos actuales.",
            );
          }}
          onSuccess={(resultado) => {
            cerrarRevision();
            limpiar();
            setMensaje(
              `Se otorgaron ${resultado.otorgamientos.length} cupos. La asignación y los pendientes están actualizados.`,
            );
            setAdvertencias(resultado.advertencias);
          }}
        />
      )}
    </div>
  );
}
