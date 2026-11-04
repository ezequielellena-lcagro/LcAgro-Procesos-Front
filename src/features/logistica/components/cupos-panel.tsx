import { History, Link2, Undo2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { toAppError } from "@/lib/api-error";
import { FilterField } from "@/shared/components/filter-bar";
import { fecha, hoy, sumarDias } from "../format";
import { confirmacionPendiente } from "../lib/comandos";
import { filtrosComercialesVacios, paramsComerciales } from "../lib/filtros-comerciales";
import { usePaginacion } from "../lib/paginacion";
import { cursorPropio, useListado, useOperacion } from "../queries/use-logistica";
import type {
  ClaveCupo,
  CupoPlan,
  DeshacerResultado,
  Otorgamiento,
  OtorgarResultado,
  Pedido,
} from "../types";
import { BotonIcono } from "./boton-icono";
import { Elegir } from "./elegir";
import { FiltrosComercialesCampos } from "./filtros-comerciales";
import { Campo, FormOperacionFooter } from "./form-operacion";
import { HistorialDialog } from "./historial-dialog";
import { Paginacion } from "./paginacion";
import { PedidosCupoEsperando } from "./pedidos-cupo-esperando";
import { PeriodoFiltro } from "./periodo-filtro";
import { PlanCargaBoton } from "./plan-carga-boton";
import { TablaLogistica } from "./tabla-logistica";
import { Vencimiento } from "./vencimiento";

const filtrosVacios = { ...filtrosComercialesVacios, contrato: "" };
const claveTexto = (c: ClaveCupo) => `${c.contrato}|${c.plan}|${c.cupo}`;
const soloClave = ({ contrato, plan, cupo }: ClaveCupo): ClaveCupo => ({ contrato, plan, cupo });
const cerealCampania = (c: {
  productoNombre?: string | null;
  producto: number | null;
  campania: string | null;
}) =>
  `${c.productoNombre ?? (c.producto != null ? `Cereal ${c.producto}` : "Sin cereal")} ${c.campania ?? ""}`.trim();
const cliente = (p: { clienteNombre?: string | null; clienteNumero: number }) =>
  p.clienteNombre ?? `Cliente ${p.clienteNumero}`;
const nombreCupo = (c: CupoPlan) => c.codigo ?? `plan ${c.plan} cupo ${c.cupo}`;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Lo vinculado, agrupado por plan: cada plan de MacroGest tiene su Plan de Carga. */
function porPlan(otorgamientos: Otorgamiento[]) {
  const planes = new Map<string, Otorgamiento[]>();
  for (const o of otorgamientos) {
    const k = `${o.contrato}|${o.plan}`;
    planes.set(k, [...(planes.get(k) ?? []), o]);
  }
  return [...planes.values()];
}

/**
 * Los cupos del plan de carga de MacroGest (decidido el 2026-11-02): César los carga una sola vez,
 * en MacroGest, al armar el plan, y acá dice a qué pedido va cada uno. Del día de carga más nuevo
 * al más viejo.
 *
 * Desde la fila del pedido se llega con `pedido`: los cupos elegidos se vinculan a ese pedido. Si
 * no, el pedido se elige al vincular.
 */
export function CuposPanel({
  activo,
  gestionar,
  pedido,
  onVolver,
}: {
  activo: boolean;
  gestionar: boolean;
  pedido?: Pedido | null;
  onVolver?: () => void;
}) {
  const [periodo, setPeriodo] = useState(() => ({
    desde: sumarDias(hoy(), -7),
    hastaExclusivo: sumarDias(hoy(), 8),
  }));
  const inicial = pedido
    ? { producto: String(pedido.producto), campania: pedido.campania, contrato: "" }
    : filtrosVacios;
  const [borrador, setBorrador] = useState(inicial);
  const [aplicados, setAplicados] = useState(inicial);
  const [seleccion, setSeleccion] = useState<CupoPlan[]>([]);
  const [elegirPedido, setElegirPedido] = useState<CupoPlan[] | null>(null);
  const [desvincular, setDesvincular] = useState<CupoPlan | null>(null);
  const [historia, setHistoria] = useState<CupoPlan | null>(null);
  const [vinculado, setVinculado] = useState<{
    resultado: OtorgarResultado;
    cliente: string;
  } | null>(null);
  const alPedido = useOperacion<OtorgarResultado>("otorgamientos");
  const lista = useListado<CupoPlan>(
    "cupos",
    {
      ...periodo,
      ...paramsComerciales(aplicados),
      contrato: aplicados.contrato.trim() || undefined,
    },
    (f) => ({
      despuesFecha: f.fechaCarga,
      despuesContrato: f.contrato,
      despuesPlan: f.plan,
      despuesCupo: f.cupo,
    }),
    activo,
    undefined,
    50,
  );
  const paginacion = usePaginacion(lista);
  const grupo = seleccion[0];
  const elegido = (f: CupoPlan) => seleccion.some((c) => claveTexto(c) === claveTexto(f));
  /** Por qué no se puede elegir: el servidor rechaza mezclar cereales o pasar lo que falta. */
  const motivo = (f: CupoPlan): string | null => {
    if (pedido && (f.producto !== pedido.producto || f.campania !== pedido.campania))
      return `Es ${cerealCampania(f)}; el pedido es ${cerealCampania(pedido)}`;
    if (grupo && (grupo.producto !== f.producto || grupo.campania !== f.campania))
      return `Es ${cerealCampania(f)}; elegiste ${cerealCampania(grupo)}`;
    if (pedido && seleccion.length >= pedido.pendientes)
      return pedido.pendientes === 0
        ? "El pedido ya tiene todos sus cupos"
        : pedido.pendientes === 1
          ? "Ya cubriste el que le falta al pedido"
          : `Ya cubriste los ${pedido.pendientes} que le faltan al pedido`;
    return null;
  };
  const alternar = (f: CupoPlan) =>
    setSeleccion((actual) =>
      actual.some((c) => claveTexto(c) === claveTexto(f))
        ? actual.filter((c) => claveTexto(c) !== claveTexto(f))
        : motivo(f) != null
          ? actual
          : [...actual, structuredClone(f)],
    );
  const listo = (r: OtorgarResultado, nombre: string) => {
    setSeleccion([]);
    setElegirPedido(null);
    setVinculado({ resultado: r, cliente: nombre });
  };
  const vincularAlPedido = async (p: Pedido) => {
    if (alPedido.isPending) return;
    try {
      listo(
        await alPedido.mutateAsync({
          pedidoId: p.id,
          pedidoRevision: p.revision,
          cupos: seleccion.map(soloClave),
        }),
        cliente(p),
      );
    } catch (error) {
      // El pedido o los cupos cambiaron: se relee la lista y se elige de nuevo.
      if (toAppError(error).status === 409) setSeleccion([]);
    }
  };
  const libres = paginacion.filas.filter((f) => !f.otorgamiento && motivo(f) == null).length;
  return (
    <section aria-label="Cupos del plan de carga" className="min-w-0 space-y-3">
      {pedido ? (
        <section aria-label="Pedido elegido" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink">
              Elegí los cupos del plan de carga que van a este pedido.
            </p>
            {onVolver && (
              <Button size="sm" variant="outline" onClick={onVolver}>
                Volver a Pedidos
              </Button>
            )}
          </div>
          <FichaPedido pedido={pedido} />
        </section>
      ) : (
        <p className="text-sm text-ink-soft">
          Los cupos que César carga en el plan de carga de MacroGest. Acá se vincula cada uno con el
          pedido al que va.
        </p>
      )}
      {vinculado && (
        <div role="status" className="rounded-card border border-line bg-panel p-4 shadow-card">
          <p className="font-medium text-ink">
            Se{" "}
            {vinculado.resultado.otorgamientos.length === 1
              ? "vinculó 1 cupo"
              : `vincularon ${vinculado.resultado.otorgamientos.length} cupos`}{" "}
            al pedido de {vinculado.cliente}.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink">Plan de Carga para mandar al cliente:</span>
            {porPlan(vinculado.resultado.otorgamientos).map((delPlan) => (
              <PlanCargaBoton
                key={`${delPlan[0].contrato}|${delPlan[0].plan}`}
                otorgamientoId={delPlan[0].id}
                variant="default"
                texto={`Contrato ${delPlan[0].contrato} · plan ${delPlan[0].plan}`}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {onVolver && (
              <Button variant="outline" onClick={onVolver}>
                Volver a Pedidos
              </Button>
            )}
            <Button variant="ghost" onClick={() => setVinculado(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
      <PeriodoFiltro
        value={periodo}
        onChange={setPeriodo}
        etiquetas={{ desde: "Carga desde", hasta: "Carga hasta" }}
        onSubmit={(e) => {
          e.preventDefault();
          setAplicados({ ...borrador });
        }}
      >
        <FiltrosComercialesCampos
          value={borrador}
          onChange={(v) => setBorrador({ ...borrador, ...v })}
          onClear={() => {
            setBorrador(filtrosVacios);
            setAplicados(filtrosVacios);
          }}
        >
          <FilterField label="Contrato">
            <Input
              className="w-40"
              maxLength={15}
              value={borrador.contrato}
              onChange={(e) => setBorrador({ ...borrador, contrato: e.target.value })}
            />
          </FilterField>
        </FiltrosComercialesCampos>
      </PeriodoFiltro>
      <TablaLogistica
        titulo="Cupos del plan de carga"
        densa
        filas={paginacion.filas}
        clave={claveTexto}
        elegida={elegido}
        cargando={lista.isLoading}
        error={lista.error}
        reintentar={() => void lista.refetch()}
        pie={<Paginacion {...paginacion} unidad={{ singular: "cupo", plural: "cupos" }} />}
        vacio="No hay cupos en los planes de carga de MacroGest para estas fechas."
        columnas={[
          ...(gestionar
            ? [
                {
                  titulo: "Elegir",
                  celda: (f: CupoPlan) =>
                    f.otorgamiento ? null : (
                      <Elegir
                        tipo="checkbox"
                        etiqueta={`Elegir cupo ${nombreCupo(f)}`}
                        checked={elegido(f)}
                        motivo={motivo(f)}
                        onChange={() => alternar(f)}
                      />
                    ),
                },
              ]
            : []),
          { titulo: "Fecha de carga", celda: (f) => fecha(f.fechaCarga) },
          {
            titulo: "Contrato",
            celda: (f) => <Renglon principal={f.contrato} secundario={f.destinoNombre} />,
          },
          {
            titulo: "Cupo",
            celda: (f) => (
              <Renglon principal={f.codigo ?? "—"} secundario={`Plan ${f.plan} · cupo ${f.cupo}`} />
            ),
          },
          { titulo: "Cereal / campaña", celda: (f) => cerealCampania(f) },
          {
            titulo: "Plan de carga",
            celda: (f) =>
              f.planta == null ? (
                "—"
              ) : (
                <Renglon
                  principal={`Planta ${f.planta}`}
                  secundario={
                    f.productorNombre ??
                    (f.productorNumero != null ? `Cliente ${f.productorNumero}` : null)
                  }
                />
              ),
          },
          {
            titulo: "Pedido",
            celda: (f) =>
              f.otorgamiento ? (
                <Renglon
                  principal={cliente(f.otorgamiento)}
                  secundario={
                    f.otorgamiento.preventa
                      ? `${f.otorgamiento.preventa.operacion} ${f.otorgamiento.preventa.numero}`
                      : "Sin preventa"
                  }
                />
              ) : (
                "—"
              ),
          },
          {
            titulo: "Acciones",
            celda: (f) => (
              <div className="flex gap-1">
                {f.otorgamiento ? (
                  <>
                    <PlanCargaBoton otorgamientoId={f.otorgamiento.id} soloIcono />
                    {gestionar && (
                      <BotonIcono
                        icono={Undo2}
                        etiqueta="Desvincular del pedido"
                        className="text-rojo"
                        onClick={() => setDesvincular(f)}
                      />
                    )}
                    <BotonIcono
                      icono={History}
                      etiqueta="Historial"
                      onClick={() => setHistoria(f)}
                    />
                  </>
                ) : (
                  gestionar &&
                  !pedido && (
                    <BotonIcono
                      icono={Link2}
                      etiqueta="Vincular a un pedido"
                      onClick={() => setElegirPedido([structuredClone(f)])}
                    />
                  )
                )}
              </div>
            ),
          },
        ]}
      />
      {pedido && !lista.isLoading && libres < pedido.pendientes && <PedidosCupoEsperando />}
      {gestionar && seleccion.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-1 space-y-2 rounded-card border border-line bg-panel/95 px-4 py-3 shadow-card backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong>{plural(seleccion.length, "cupo elegido", "cupos elegidos")}</strong> ·{" "}
              {cerealCampania(grupo)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={alPedido.isPending}
                onClick={() => setSeleccion([])}
              >
                Limpiar selección
              </Button>
              {pedido ? (
                <Button disabled={alPedido.isPending} onClick={() => void vincularAlPedido(pedido)}>
                  <Link2 className="size-4" aria-hidden />{" "}
                  {alPedido.isPending
                    ? "Vinculando…"
                    : confirmacionPendiente(alPedido.error)
                      ? "Reintentar"
                      : `Vincular ${plural(seleccion.length, "cupo", "cupos")} a este pedido`}
                </Button>
              ) : (
                <Button onClick={() => setElegirPedido(seleccion.map((c) => structuredClone(c)))}>
                  <Link2 className="size-4" aria-hidden />{" "}
                  {`Vincular ${plural(seleccion.length, "cupo", "cupos")} a un pedido`}
                </Button>
              )}
            </div>
          </div>
          {alPedido.error != null && (
            <p role="alert" className="text-sm text-rojo">
              {toAppError(alPedido.error).message}
            </p>
          )}
        </div>
      )}
      {elegirPedido && (
        <VincularDialog
          cupos={elegirPedido}
          onClose={() => setElegirPedido(null)}
          onVinculado={(r, p) => listo(r, cliente(p))}
        />
      )}
      {desvincular?.otorgamiento && (
        <DesvincularDialog
          cupo={desvincular}
          otorgamiento={desvincular.otorgamiento}
          onClose={() => setDesvincular(null)}
        />
      )}
      {historia?.otorgamiento && (
        <HistorialDialog
          recurso="otorgamientos"
          id={historia.otorgamiento.id}
          descripcion={`Contrato ${historia.contrato} · cupo ${nombreCupo(historia)}`}
          onClose={() => setHistoria(null)}
        />
      )}
    </section>
  );
}

/** Dato y aclaración en un solo renglón; lo que no entra se corta y se lee al pasar el mouse. */
function Renglon({ principal, secundario }: { principal: string; secundario?: string | null }) {
  return (
    <span className="flex max-w-[18rem] items-baseline gap-1.5">
      <span className="shrink-0">{principal}</span>
      {secundario && (
        <span className="truncate text-xs text-ink-soft" title={secundario}>
          {secundario}
        </span>
      )}
    </span>
  );
}

/** Ficha del pedido al que se vinculan los cupos. */
function FichaPedido({ pedido }: { pedido: Pedido }) {
  const datos: [string, ReactNode][] = [
    ["Productor", cliente(pedido)],
    [
      "Preventa",
      pedido.preventa ? `${pedido.preventa.operacion} ${pedido.preventa.numero}` : "Sin preventa",
    ],
    ["Cereal / campaña", cerealCampania(pedido)],
    ["Para cuándo", fecha(pedido.fechaSolicitada)],
    ["Carga", pedido.seCargaEnPlanta ? "En planta" : "En campo"],
    ["Faltan", `${pedido.pendientes} de ${pedido.cantidadCupos}`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-card border border-line bg-panel p-4 text-sm shadow-card sm:grid-cols-3 lg:grid-cols-6">
      {datos.map(([titulo, valor]) => (
        <div key={titulo} className="min-w-0">
          <dt className="text-xs text-ink-soft">{titulo}</dt>
          <dd className="font-medium text-ink">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Elegir el pedido de los cupos elegidos entre todos los pedidos pendientes, sin filtros (pedido
 * de Ezequiel, 2026-11-04). Primero los que se pueden elegir y, entre ellos, los del productor
 * del plan; después, por prioridad de entrega. Los de otro cereal o campaña, o a los que les
 * faltan menos cupos, se ven y dicen por qué no se pueden elegir.
 */
function VincularDialog({
  cupos,
  onClose,
  onVinculado,
}: {
  cupos: CupoPlan[];
  onClose: () => void;
  onVinculado: (r: OtorgarResultado, pedido: Pedido) => void;
}) {
  const [elegido, setElegido] = useState<Pedido | null>(null);
  const mutation = useOperacion<OtorgarResultado>("otorgamientos");
  const ocupado = mutation.isPending || confirmacionPendiente(mutation.error);
  const primero = cupos[0];
  const pedidos = useListado<Pedido>(
    "pedidos",
    { soloPendientes: true, orden: "prioridad" },
    cursorPropio,
  );
  const productores = new Set(cupos.map((c) => c.productorNumero));
  // El servidor pide el mismo cereal y campaña que el contrato del cupo (devolución del 23/10).
  const motivo = (p: Pedido) =>
    p.producto !== primero.producto || p.campania !== primero.campania
      ? `Es ${cerealCampania(p)}; ${cupos.length === 1 ? "el cupo es" : "los cupos son"} ${cerealCampania(primero)}`
      : p.pendientes < cupos.length
        ? `Le ${p.pendientes === 1 ? "falta 1 cupo" : `faltan ${p.pendientes} cupos`}`
        : null;
  const filas = [...(pedidos.data?.pages[0]?.filas ?? [])].sort(
    (a, b) =>
      Number(motivo(a) != null) - Number(motivo(b) != null) ||
      Number(!productores.has(a.clienteNumero)) - Number(!productores.has(b.clienteNumero)),
  );
  const contratos = [...new Set(cupos.map((c) => c.contrato))].join(", ");
  return (
    <Modal
      open
      title="Vincular a un pedido"
      className="max-w-5xl"
      onClose={() => !ocupado && onClose()}
    >
      <p className="mb-3 text-sm text-ink">
        <strong>{plural(cupos.length, "cupo", "cupos")}</strong> de {cerealCampania(primero)}{" "}
        (contrato {contratos}). Elegí el pedido al que van.
      </p>
      <TablaLogistica
        titulo="Pedidos con cupos pendientes"
        filas={filas}
        clave={(f) => f.id}
        elegida={(f) => elegido?.id === f.id}
        cargando={pedidos.isLoading}
        error={pedidos.error}
        reintentar={() => void pedidos.refetch()}
        vacio="No hay pedidos con cupos pendientes."
        columnas={[
          {
            titulo: "Elegir",
            celda: (f) => (
              <Elegir
                tipo="radio"
                name="pedido-vincular"
                etiqueta={`Elegir pedido de ${cliente(f)}`}
                checked={elegido?.id === f.id}
                motivo={motivo(f)}
                onChange={() => setElegido(structuredClone(f))}
              />
            ),
          },
          {
            titulo: "Productor",
            celda: (f) => (
              <span>
                {cliente(f)}
                <span className="block text-xs text-ink-soft">
                  {f.seCargaEnPlanta ? "Se carga en planta" : `Cliente ${f.clienteNumero}`}
                </span>
              </span>
            ),
          },
          { titulo: "Cereal / campaña", celda: (f) => cerealCampania(f) },
          {
            titulo: "Preventa",
            celda: (f) =>
              f.preventa ? `${f.preventa.operacion} ${f.preventa.numero}` : "Sin preventa",
          },
          {
            titulo: "Vencimiento preventa",
            celda: (f) => (f.preventa ? <Vencimiento hasta={f.preventaEntregaHasta} /> : "—"),
          },
          { titulo: "Para cuándo", celda: (f) => fecha(f.fechaSolicitada) },
          { titulo: "Faltan", numero: true, celda: (f) => f.pendientes },
        ]}
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!elegido || mutation.isPending) return;
          try {
            onVinculado(
              await mutation.mutateAsync({
                pedidoId: elegido.id,
                pedidoRevision: elegido.revision,
                cupos: cupos.map(soloClave),
              }),
              elegido,
            );
          } catch {
            // El pie muestra el error del servidor.
          }
        }}
      >
        <FormOperacionFooter
          error={mutation.error}
          invalid={false}
          pending={mutation.isPending}
          onClose={onClose}
          texto={
            elegido
              ? `Vincular ${plural(cupos.length, "cupo", "cupos")} al pedido de ${cliente(elegido)}`
              : "Elegí el pedido"
          }
        />
      </form>
    </Modal>
  );
}

/** Desvincular un cupo de su pedido, con motivo. En MacroGest no cambia nada: el plan es de César. */
function DesvincularDialog({
  cupo,
  otorgamiento,
  onClose,
}: {
  cupo: CupoPlan;
  otorgamiento: Otorgamiento;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [invalido, setInvalido] = useState(false);
  const mutation = useOperacion<DeshacerResultado>(`otorgamientos/${otorgamiento.id}/deshacer`);
  return (
    <Modal open title="Desvincular del pedido" onClose={() => !mutation.isPending && onClose()}>
      <p className="mb-3 text-sm text-ink-soft">
        Contrato {cupo.contrato}, cupo {nombreCupo(cupo)}, del pedido de {cliente(otorgamiento)}. El
        cupo queda sin pedido y el pedido recupera ese pendiente.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!motivo.trim()) {
            setInvalido(true);
            return;
          }
          try {
            await mutation.mutateAsync({ revision: otorgamiento.revision, motivo: motivo.trim() });
            onClose();
          } catch {
            // El pie muestra el error del servidor.
          }
        }}
      >
        <Campo titulo="Motivo">
          <Textarea
            maxLength={500}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setInvalido(false);
            }}
          />
        </Campo>
        <FormOperacionFooter
          error={mutation.error}
          invalid={invalido}
          pending={mutation.isPending}
          onClose={onClose}
          texto="Desvincular"
        />
      </form>
    </Modal>
  );
}
