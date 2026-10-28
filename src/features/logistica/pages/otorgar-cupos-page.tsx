import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useCallback, useState } from "react";
import { useBeforeUnload, useBlocker, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toAppError } from "@/lib/api-error";
import { PageHeader } from "@/shared/components/page-header";
import { AvisoDemo } from "../components/aviso-demo";
import { Elegir } from "../components/elegir";
import { FormOperacionFooter } from "../components/form-operacion";
import { LeDebemos } from "../components/le-debemos";
import { PedidosCupoEsperando } from "../components/pedidos-cupo-esperando";
import { PeriodoFiltro } from "../components/periodo-filtro";
import { FiltrosComercialesCampos } from "../components/filtros-comerciales";
import { PlanCargaBoton } from "../components/plan-carga-boton";
import { TablaLogistica } from "../components/tabla-logistica";
import { fecha, periodoInicial } from "../format";
import { confirmacionPendiente } from "../lib/comandos";
import {
  filtrosComercialesIniciales,
  filtrosComercialesVacios,
  paramsComerciales,
} from "../lib/filtros-comerciales";
import { cursorPropio, useDetalle, useListado, useOperacion } from "../queries/use-logistica";
import type { CupoPlanta0, Otorgamiento, OtorgarResultado, Pedido } from "../types";

type Paso = "pedido" | "cupos" | "revisar" | "listo";
const PASOS: { id: Paso; titulo: string }[] = [
  { id: "pedido", titulo: "Pedido" },
  { id: "cupos", titulo: "Cupos" },
  { id: "revisar", titulo: "Revisar" },
  { id: "listo", titulo: "Plan de Carga" },
];
const claveCupo = (c: { contrato: string; plan: number; cupo: number }) =>
  `${c.contrato}/${c.plan}/${c.cupo}`;
const productor = (p: Pedido) => p.clienteNombre ?? `Cliente ${p.clienteNumero}`;
const cereal = (f: { productoNombre?: string | null; producto: number | null }) =>
  f.productoNombre ?? f.producto ?? "Sin cereal";

/** Avisos que se ven antes de confirmar; el servidor suma los del plan repartido al leer MacroGest. */
function avisos(cupos: CupoPlanta0[], pedido: Pedido) {
  const resultado: string[] = [];
  if (cupos.some((c) => !c.codigoTerminal)) resultado.push("Hay cupos sin código otorgado.");
  if (new Set(cupos.map((c) => c.fechaCarga)).size > 1)
    resultado.push("Las fechas de carga son distintas.");
  if (cupos.some((c) => c.fechaCarga !== pedido.fechaSolicitada))
    resultado.push("Hay cupos con fecha de carga distinta de la fecha pedida.");
  if (new Set(cupos.map((c) => c.destinoCodigo)).size > 1)
    resultado.push("Los destinos son distintos.");
  if (new Set(cupos.map((c) => `${c.contrato}/${c.plan}`)).size > 1)
    resultado.push("Son de más de un plan de carga: en MacroGest hay que pasar cada plan.");
  return resultado;
}

/**
 * Otorgar cupos a un pedido, por pasos: el pedido, los cupos de planta 0 de su cereal y campaña,
 * la revisión y el Plan de Carga para mandar.
 *
 * Se entra desde la fila del pedido (con `?pedido=` arranca en los cupos) o desde «Otorgar cupo»
 * en Cupos (arranca eligiendo el pedido). Todo otorgamiento sale de un pedido: «cliente sin
 * pedido» y «propio» no los pidió el área usuaria (decidido el 2026-10-28).
 */
export function OtorgarCuposPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pedidoId = params.get("pedido");
  const [paso, setPaso] = useState<Paso>(pedidoId ? "cupos" : "pedido");
  // El pedido de la URL hasta que se elija otro; después, el elegido.
  const [elegido, setElegido] = useState<Pedido | null>(null);
  const [usarInicial, setUsarInicial] = useState(!!pedidoId);
  // `null` = la elección automática: los primeros cupos libres hasta cubrir lo pendiente.
  const [seleccion, setSeleccion] = useState<CupoPlanta0[] | null>(null);
  const [resultado, setResultado] = useState<OtorgarResultado | null>(null);
  const [aviso, setAviso] = useState("");
  const inicial = useDetalle<Pedido>(`pedidos/${pedidoId}`, {}, !!pedidoId && usarInicial);
  const pedido = elegido ?? (usarInicial ? (inicial.data ?? null) : null);
  const mutation = useOperacion<OtorgarResultado>("otorgamientos");
  const ocupado = mutation.isPending || confirmacionPendiente(mutation.error);
  const volver = () => {
    if (!ocupado) void navigate(pedidoId ? "/logistica/pedidos" : "/logistica/cupos");
  };
  const elegirPedido = (p: Pedido) => {
    setElegido(structuredClone(p));
    setUsarInicial(false);
    setSeleccion(null);
    setAviso("");
  };
  return (
    <>
      <PageHeader
        title="Otorgar cupos"
        subtitle="Elegí el pedido y los cupos de planta 0 de MacroGest que le das. Después pasás el plan en MacroGest y la app lo confirma al leerlo."
        actions={
          <Button variant="outline" disabled={ocupado} onClick={volver}>
            <ArrowLeft className="size-4" aria-hidden />{" "}
            {pedidoId ? "Volver a Pedidos" : "Volver a Cupos"}
          </Button>
        }
      />
      <AvisoDemo />
      <Pasos actual={paso} />
      {aviso && (
        <p role="status" className="mb-4 rounded-card border border-line bg-panel p-3 text-sm">
          {aviso}
        </p>
      )}
      {paso === "pedido" && (
        <PasoPedido elegido={pedido} onElegir={elegirPedido} onSiguiente={() => setPaso("cupos")} />
      )}
      {paso === "cupos" &&
        (pedido ? (
          <PasoCupos
            pedido={pedido}
            seleccion={seleccion}
            onSeleccion={setSeleccion}
            onAtras={() => setPaso("pedido")}
            onSiguiente={(cupos) => {
              setSeleccion(cupos);
              setPaso("revisar");
            }}
          />
        ) : inicial.error ? (
          <p role="alert" className="text-sm text-rojo">
            {toAppError(inicial.error).message}
          </p>
        ) : (
          <p className="text-sm text-ink-soft">Cargando el pedido…</p>
        ))}
      {paso === "revisar" && pedido && (
        <PasoRevisar
          pedido={pedido}
          cupos={seleccion ?? []}
          mutation={mutation}
          onAtras={() => setPaso("cupos")}
          onConflicto={async () => {
            mutation.reset();
            setSeleccion(null);
            setElegido(null);
            setUsarInicial(!!pedidoId);
            if (pedidoId) await inicial.refetch();
            setPaso(pedidoId ? "cupos" : "pedido");
            setAviso(
              "MacroGest u otro operador cambió los cupos o el pedido. Actualizamos los datos; elegí de nuevo.",
            );
          }}
          onOtorgado={(r) => {
            // El servidor devuelve el pedido actualizado sin los nombres de MacroGest.
            const actualizado: Pedido = {
              ...r.pedido,
              clienteNombre: r.pedido.clienteNombre ?? pedido.clienteNombre,
              productoNombre: r.pedido.productoNombre ?? pedido.productoNombre,
            };
            setResultado({ ...r, pedido: actualizado });
            setElegido(actualizado);
            setAviso("");
            setPaso("listo");
          }}
        />
      )}
      {paso === "listo" && resultado && (
        <PasoListo
          resultado={resultado}
          onOtroPedido={() => {
            mutation.reset();
            setResultado(null);
            setElegido(null);
            setUsarInicial(false);
            setSeleccion(null);
            setPaso("pedido");
          }}
          onVerOtorgados={() => void navigate("/logistica/cupos#otorgados")}
          onVolverPedidos={() => void navigate("/logistica/pedidos")}
        />
      )}
    </>
  );
}

/** Indicador de los pasos: dónde estás y qué falta. */
function Pasos({ actual }: { actual: Paso }) {
  const indice = PASOS.findIndex((p) => p.id === actual);
  return (
    <ol aria-label="Pasos para otorgar" className="mb-5 flex flex-wrap items-center gap-2 text-sm">
      {PASOS.map((p, i) => (
        <li key={p.id} className="flex items-center gap-2">
          <span
            aria-current={i === indice ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
              i === indice
                ? "border-primary bg-primary font-semibold text-primary-foreground"
                : i < indice
                  ? "border-line bg-secondary text-ink"
                  : "border-line text-ink-soft"
            }`}
          >
            {i < indice ? <Check className="size-4" aria-hidden /> : <span>{i + 1}</span>}
            {p.titulo}
          </span>
          {i < PASOS.length - 1 && <span className="text-ink-soft">›</span>}
        </li>
      ))}
    </ol>
  );
}

/** Barra de acciones de cada paso, fija abajo: el botón para avanzar se ve sin scrollear. */
function Barra({ children, resumen }: { children: React.ReactNode; resumen?: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-panel/95 px-4 py-3 shadow-card backdrop-blur">
      <p className="text-sm">{resumen}</p>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

/** Ficha del pedido elegido, arriba de los pasos que siguen. */
function FichaPedido({ pedido }: { pedido: Pedido }) {
  const datos: [string, React.ReactNode][] = [
    ["Productor", productor(pedido)],
    [
      "Preventa",
      pedido.preventa ? `${pedido.preventa.operacion} ${pedido.preventa.numero}` : "Sin preventa",
    ],
    ["Cereal / campaña", `${cereal(pedido)} ${pedido.campania}`],
    ["Para cuándo", fecha(pedido.fechaSolicitada)],
    ["Carga", pedido.seCargaEnPlanta ? "En planta" : "En campo"],
    ["Faltan", `${pedido.pendientes} de ${pedido.cantidadCupos}`],
  ];
  return (
    <section aria-label="Pedido elegido">
      <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-card border border-line bg-panel p-4 text-sm shadow-card sm:grid-cols-3 lg:grid-cols-6">
        {datos.map(([titulo, valor]) => (
          <div key={titulo} className="min-w-0">
            <dt className="text-xs text-ink-soft">{titulo}</dt>
            <dd className="font-medium text-ink">{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PasoPedido({
  elegido,
  onElegir,
  onSiguiente,
}: {
  elegido: Pedido | null;
  onElegir: (p: Pedido) => void;
  onSiguiente: () => void;
}) {
  const [periodo, setPeriodo] = useState(() => periodoInicial());
  const [borrador, setBorrador] = useState(filtrosComercialesIniciales);
  const [comercial, setComercial] = useState(borrador);
  // Por prioridad: primero a quien se le debe cereal hace más tiempo.
  const pendientes = useListado<Pedido>(
    "pedidos",
    { ...periodo, ...paramsComerciales(comercial), soloPendientes: true, orden: "prioridad" },
    cursorPropio,
  );
  return (
    <section aria-label="Elegir el pedido" className="min-w-0 space-y-3">
      <PeriodoFiltro
        value={periodo}
        onChange={setPeriodo}
        onSubmit={(e) => {
          e.preventDefault();
          setComercial(borrador);
        }}
      >
        <FiltrosComercialesCampos
          value={borrador}
          onChange={setBorrador}
          onClear={() => {
            setBorrador(filtrosComercialesVacios);
            setComercial(filtrosComercialesVacios);
          }}
        />
      </PeriodoFiltro>
      <TablaLogistica
        titulo="Pedidos con cupos pendientes"
        filas={pendientes.data?.pages[0]?.filas ?? []}
        clave={(f) => f.id}
        elegida={(f) => elegido?.id === f.id}
        cargando={pendientes.isLoading}
        error={pendientes.error}
        reintentar={() => void pendientes.refetch()}
        vacio="No hay pedidos con cupos pendientes para estas fechas."
        columnas={[
          {
            titulo: "Elegir",
            celda: (f) => (
              <Elegir
                tipo="radio"
                name="pedido-otorgar"
                etiqueta={`Elegir pedido de ${productor(f)}`}
                checked={elegido?.id === f.id}
                motivo={null}
                onChange={() => onElegir(f)}
              />
            ),
          },
          {
            titulo: "Productor",
            celda: (f) => (
              <span>
                {productor(f)}
                <span className="block text-xs text-ink-soft">Cliente {f.clienteNumero}</span>
              </span>
            ),
          },
          {
            titulo: "Preventa",
            celda: (f) =>
              f.preventa ? `${f.preventa.operacion} ${f.preventa.numero}` : "Sin preventa",
          },
          { titulo: "Le debemos hace", celda: (f) => <LeDebemos pedido={f} /> },
          { titulo: "Cereal / campaña", celda: (f) => `${cereal(f)} ${f.campania}` },
          { titulo: "Para cuándo", celda: (f) => fecha(f.fechaSolicitada) },
          { titulo: "Pendientes", numero: true, celda: (f) => f.pendientes },
        ]}
      />
      <Barra
        resumen={
          elegido ? (
            <>
              <strong>{productor(elegido)}</strong> · faltan {elegido.pendientes}
            </>
          ) : (
            <span className="text-ink-soft">Elegí el pedido</span>
          )
        }
      >
        <Button disabled={!elegido} onClick={onSiguiente}>
          Elegir cupos <ArrowRight className="size-4" aria-hidden />
        </Button>
      </Barra>
    </section>
  );
}

function PasoCupos({
  pedido,
  seleccion,
  onSeleccion,
  onAtras,
  onSiguiente,
}: {
  pedido: Pedido;
  seleccion: CupoPlanta0[] | null;
  onSeleccion: (s: CupoPlanta0[]) => void;
  onAtras: () => void;
  onSiguiente: (cupos: CupoPlanta0[]) => void;
}) {
  const disponibles = useListado<CupoPlanta0>(
    "cupos/planta-0",
    { producto: pedido.producto, campania: Number(pedido.campania.replace("-", "")) },
    (f) => ({
      despuesFecha: f.fechaCarga,
      despuesContrato: f.contrato,
      despuesPlan: f.plan,
      despuesCupo: f.cupo,
    }),
  );
  const filas = disponibles.data?.pages.flatMap((p) => p.filas) ?? [];
  const libres = filas.filter((f) => !f.otorgamientoVigente);
  const limite = Math.min(200, pedido.pendientes);
  // Mientras no se toque nada, van elegidos los primeros cupos libres hasta cubrir lo pendiente:
  // lo más automático posible (devolución del 2026-10-23). Se cambian tocando los casilleros.
  const efectiva = seleccion ?? libres.slice(0, limite);
  const elegido = (f: CupoPlanta0) => efectiva.some((c) => claveCupo(c) === claveCupo(f));
  const motivo = (f: CupoPlanta0): string | null => {
    if (f.otorgamientoVigente)
      return `Otorgado en la app a ${f.otorgamientoVigente.clienteNombre ?? `cliente ${f.otorgamientoVigente.clienteNumero}`}; falta pasarlo en MacroGest`;
    if (efectiva.length >= limite) return `Ya cubriste los ${limite} pendientes del pedido`;
    return null;
  };
  return (
    <section aria-label="Elegir los cupos" className="min-w-0 space-y-3">
      <FichaPedido pedido={pedido} />
      <TablaLogistica
        titulo={`Cupos de planta 0 de ${cereal(pedido)} ${pedido.campania}`}
        filas={filas}
        clave={claveCupo}
        elegida={elegido}
        cargando={disponibles.isLoading}
        error={disponibles.error}
        reintentar={() => void disponibles.refetch()}
        hayMas={disponibles.hasNextPage}
        mas={() => void disponibles.fetchNextPage()}
        cargandoMas={disponibles.isFetchingNextPage}
        vacio={`No hay cupos de ${cereal(pedido)} ${pedido.campania} en planta 0 de hoy en adelante.`}
        columnas={[
          {
            titulo: "Elegir",
            celda: (f) => (
              <Elegir
                tipo="checkbox"
                etiqueta={`Elegir cupo ${f.codigoTerminal ?? claveCupo(f)}`}
                checked={elegido(f)}
                motivo={motivo(f)}
                onChange={() =>
                  onSeleccion(
                    elegido(f)
                      ? efectiva.filter((c) => claveCupo(c) !== claveCupo(f))
                      : motivo(f) != null
                        ? efectiva
                        : [...efectiva, structuredClone(f)],
                  )
                }
              />
            ),
          },
          { titulo: "Contrato", celda: (f) => f.contrato },
          { titulo: "Plan / cupo", celda: (f) => `${f.plan} / ${f.cupo}` },
          { titulo: "Código otorgado", celda: (f) => f.codigoTerminal || "Sin código" },
          { titulo: "Fecha de carga", celda: (f) => fecha(f.fechaCarga) },
          { titulo: "Destino", celda: (f) => f.destinoNombre ?? f.destinoCodigo ?? "—" },
        ]}
      />
      {!disponibles.isLoading && libres.length < pedido.pendientes && <PedidosCupoEsperando />}
      <Barra
        resumen={
          <>
            <strong>
              {efectiva.length} {efectiva.length === 1 ? "cupo elegido" : "cupos elegidos"}
            </strong>{" "}
            de {pedido.pendientes} pendientes
          </>
        }
      >
        <Button variant="outline" onClick={onAtras}>
          <ArrowLeft className="size-4" aria-hidden /> Cambiar pedido
        </Button>
        <Button
          disabled={efectiva.length === 0 || efectiva.length > limite}
          onClick={() => onSiguiente(efectiva.map((c) => structuredClone(c)))}
        >
          Revisar <ArrowRight className="size-4" aria-hidden />
        </Button>
      </Barra>
    </section>
  );
}

function PasoRevisar({
  pedido,
  cupos,
  mutation,
  onAtras,
  onConflicto,
  onOtorgado,
}: {
  pedido: Pedido;
  cupos: CupoPlanta0[];
  mutation: ReturnType<typeof useOperacion<OtorgarResultado>>;
  onAtras: () => void;
  onConflicto: () => void;
  onOtorgado: (r: OtorgarResultado) => void;
}) {
  const ocupado = mutation.isPending || confirmacionPendiente(mutation.error);
  // Mientras se confirma no se sale de la página: el resultado tiene que verse.
  const blocker = useBlocker(ocupado);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (!ocupado) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [ocupado],
    ),
  );
  const advertencias = avisos(cupos, pedido);
  return (
    <section aria-label="Revisar el otorgamiento" className="min-w-0 space-y-3">
      <FichaPedido pedido={pedido} />
      <TablaLogistica
        titulo="Cupos a otorgar"
        filas={cupos}
        clave={claveCupo}
        columnas={[
          { titulo: "Contrato", celda: (f) => f.contrato },
          { titulo: "Plan / cupo", celda: (f) => `${f.plan} / ${f.cupo}` },
          { titulo: "Código otorgado", celda: (f) => f.codigoTerminal || "Sin código" },
          { titulo: "Destino", celda: (f) => f.destinoNombre ?? f.destinoCodigo ?? "—" },
          { titulo: "Fecha de carga", celda: (f) => fecha(f.fechaCarga) },
        ]}
      />
      {advertencias.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {advertencias.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (mutation.isPending) return;
          try {
            onOtorgado(
              await mutation.mutateAsync({
                pedidoId: pedido.id,
                pedidoRevision: pedido.revision,
                cupos: cupos.map((c) => ({ contrato: c.contrato, plan: c.plan, cupo: c.cupo })),
              }),
            );
          } catch (error) {
            if (toAppError(error).status === 409) onConflicto();
          }
        }}
      >
        <FormOperacionFooter
          error={mutation.error}
          pending={mutation.isPending}
          onClose={onAtras}
          texto={`Otorgar ${cupos.length} ${cupos.length === 1 ? "cupo" : "cupos"}`}
        />
      </form>
      {blocker.state === "blocked" && (
        <p role="status" className="text-sm text-ink-soft">
          Confirmá el resultado del otorgamiento antes de salir de esta página.
        </p>
      )}
    </section>
  );
}

function PasoListo({
  resultado,
  onOtroPedido,
  onVerOtorgados,
  onVolverPedidos,
}: {
  resultado: OtorgarResultado;
  onOtroPedido: () => void;
  onVerOtorgados: () => void;
  onVolverPedidos: () => void;
}) {
  // Un Plan de Carga por plan: si se otorgaron cupos de dos planes, salen dos.
  const planes = resultado.otorgamientos.filter(
    (o: Otorgamiento, i, todos) =>
      todos.findIndex((x) => x.contrato === o.contrato && x.plan === o.plan) === i,
  );
  const n = resultado.otorgamientos.length;
  return (
    <section aria-label="Otorgamiento registrado" className="min-w-0 space-y-4">
      <div role="status" className="rounded-card border border-line bg-panel p-4 shadow-card">
        <p className="font-medium text-ink">
          Se {n === 1 ? "otorgó 1 cupo" : `otorgaron ${n} cupos`} al pedido de{" "}
          {productor(resultado.pedido)}.
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Falta pasar el plan en MacroGest: productor {resultado.pedido.clienteNumero} y planta 10.
          En Cupos › Resumen ves cuándo queda confirmado.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink">Plan de Carga para mandar al cliente:</span>
        {planes.map((o) => (
          <PlanCargaBoton
            key={o.id}
            otorgamientoId={o.id}
            variant="default"
            texto={`Contrato ${o.contrato} · plan ${o.plan}`}
          />
        ))}
      </div>
      {resultado.advertencias.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {resultado.advertencias.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button variant="outline" onClick={onVolverPedidos}>
          Volver a Pedidos
        </Button>
        <Button variant="outline" onClick={onVerOtorgados}>
          Ver otorgados
        </Button>
        <Button onClick={onOtroPedido}>Otorgar a otro pedido</Button>
      </div>
    </section>
  );
}
