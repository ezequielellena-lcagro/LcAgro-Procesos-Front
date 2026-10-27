import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterActions } from "@/shared/components/filter-bar";
import { uuid } from "@/lib/uuid";
import { fecha, kg, periodoInicial, sumarDias } from "../format";
import { cursorPropio, useDetalle, useListado } from "../queries/use-logistica";
import type { CupoPlanta0, Otorgamiento, OtorgarBody, Pedido, Preventa } from "../types";
import { CampaniaSelect } from "./campania-select";
import { CatalogoSelect } from "./catalogo-select";
import { ColaPrioridad } from "./cola-prioridad";
import { Elegir } from "./elegir";
import { PreventaPicker } from "./contrato-picker";
import { OtorgamientoDialog, type RevisionOtorgamiento } from "./otorgamiento-dialog";
import { OtorgamientosRegistrados } from "./otorgamientos-registrados";
import { PeriodoFiltro } from "./periodo-filtro";
import { PlanCargaBoton } from "./plan-carga-boton";
import { TablaLogistica } from "./tabla-logistica";

type Modo = "pedido" | "cliente" | "propio";
const filtrosVacios = { clienteNumero: 0, producto: 0, campania: "" };
const claveCupo = (c: { contrato: string; plan: number; cupo: number }) =>
  `${c.contrato}/${c.plan}/${c.cupo}`;
const cerealCampania = (f: {
  productoNombre?: string | null;
  producto: number | null;
  campania: string | null;
}) => `${f.productoNombre ?? f.producto ?? "Sin cereal"} ${f.campania ?? "sin campaña"}`;
function compatible(
  a: { producto: number | null; campania: string | null },
  b: { producto: number | null; campania: string | null },
) {
  return a.producto === b.producto && a.campania === b.campania;
}
/** Avisos que se ven antes de confirmar; el servidor suma los del plan repartido al leer MacroGest. */
function avisos(cupos: CupoPlanta0[], pedido: Pedido | null) {
  const resultado: string[] = [];
  if (cupos.some((c) => !c.codigoTerminal)) resultado.push("Hay cupos sin código otorgado.");
  if (new Set(cupos.map((c) => c.fechaCarga)).size > 1)
    resultado.push("Las fechas de carga son distintas.");
  if (pedido && cupos.some((c) => c.fechaCarga !== pedido.fechaSolicitada))
    resultado.push("Hay cupos con fecha de carga distinta a la fecha solicitada del pedido.");
  if (new Set(cupos.map((c) => c.destinoCodigo)).size > 1)
    resultado.push("Los destinos son distintos.");
  if (new Set(cupos.map((c) => `${c.contrato}/${c.plan}`)).size > 1)
    resultado.push(
      "Elegiste cupos de más de un plan de carga: en MacroGest hay que pasar cada plan.",
    );
  return resultado;
}

/**
 * Otorgar contra el cupo de MacroGest.
 *
 * Los disponibles son los cupos de planta 0 de hoy en adelante, leídos en vivo. Cereal y campaña
 * son los del contrato al momento de leer: no se copian, así que no pueden quedar viejos (el
 * defecto que frenó la prueba del 2026-10-23).
 */
export function OtorgarPanel({
  gestionar,
  pedidoInicialId,
  onLockChange,
}: {
  gestionar: boolean;
  /** Pedido desde cuya fila se vino a otorgar: queda elegido y los cupos filtrados a su cereal. */
  pedidoInicialId?: string;
  onLockChange: (locked: boolean) => void;
}) {
  const [periodo, setPeriodo] = useState(() => periodoInicial());
  const [borrador, setBorrador] = useState(filtrosVacios);
  const [filtros, setFiltros] = useState(filtrosVacios);
  const [modo, setModo] = useState<Modo>("pedido");
  const [seleccion, setSeleccion] = useState<CupoPlanta0[]>([]);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cliente, setCliente] = useState(0);
  const [clienteNombre, setClienteNombre] = useState<string | null>(null);
  const [preventa, setPreventa] = useState<Preventa | null>(null);
  const [conPreventa, setConPreventa] = useState(false);
  const [revision, setRevision] = useState<RevisionOtorgamiento | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [advertencias, setAdvertencias] = useState<string[]>([]);
  // Lo recién otorgado, un otorgamiento por plan: de ahí sale el Plan de Carga para mandar.
  const [planes, setPlanes] = useState<Otorgamiento[]>([]);
  const [consultaId] = useState(() => uuid());
  const [paginaVersion, setPaginaVersion] = useState(0);
  const paginaContexto = { otorgar: consultaId, version: paginaVersion };
  const reiniciarPaginas = () => setPaginaVersion((version) => version + 1);
  const inicial = useDetalle<Pedido>(`pedidos/${pedidoInicialId}`, {}, !!pedidoInicialId);
  const aplicado = useRef(false);
  // Una sola vez: después el operador puede cambiar de pedido o de filtros como siempre.
  useEffect(() => {
    const p = inicial.data;
    if (!p || aplicado.current) return;
    aplicado.current = true;
    const delPedido = {
      clienteNumero: p.clienteNumero,
      producto: p.producto,
      campania: p.campania,
    };
    setModo("pedido");
    setPedido(structuredClone(p));
    setBorrador(delPedido);
    setFiltros(delPedido);
    setPeriodo({ desde: p.fechaSolicitada, hastaExclusivo: sumarDias(p.fechaSolicitada, 1) });
  }, [inicial.data]);
  const campaniaErp = /^\d{4}-\d{4}$/.test(filtros.campania)
    ? Number(filtros.campania.replace("-", ""))
    : undefined;
  const disponibles = useListado<CupoPlanta0>(
    "cupos/planta-0",
    { producto: filtros.producto || undefined, campania: campaniaErp },
    (f) => ({
      despuesFecha: f.fechaCarga,
      despuesContrato: f.contrato,
      despuesPlan: f.plan,
      despuesCupo: f.cupo,
    }),
    true,
    paginaContexto,
  );
  const pendientes = useListado<Pedido>(
    "pedidos",
    {
      ...periodo,
      producto: filtros.producto || undefined,
      campania: filtros.campania || undefined,
      clienteNumero: filtros.clienteNumero || undefined,
      soloPendientes: true,
    },
    cursorPropio,
    true,
    paginaContexto,
  );
  const grupo = seleccion[0];
  const limite = modo === "pedido" && pedido ? Math.min(200, pedido.pendientes) : 200;
  /** Por qué un cupo no se puede sumar a esta selección, con los valores que se comparan. */
  const motivoCupo = (f: CupoPlanta0): string | null => {
    if (f.otorgamientoVigente)
      return `Otorgado en la app a ${
        f.otorgamientoVigente.destinatarioTipo === "propio"
          ? "carga propia"
          : (f.otorgamientoVigente.clienteNombre ??
            `cliente ${f.otorgamientoVigente.clienteNumero}`)
      }; falta pasarlo en MacroGest`;
    if (f.producto == null || f.campania == null) return "El contrato no tiene cereal y campaña";
    if (grupo != null && !compatible(f, grupo))
      return `Cupo ${cerealCampania(f)} · elegidos ${cerealCampania(grupo)}`;
    if (modo === "pedido" && pedido != null && !compatible(f, pedido))
      return `Cupo ${cerealCampania(f)} · pedido ${cerealCampania(pedido)}`;
    if (seleccion.length >= limite)
      return modo === "pedido" && pedido
        ? `Ya cubriste los ${limite} pendientes del pedido`
        : `Máximo ${limite} cupos por operación`;
    return null;
  };
  const valido =
    seleccion.length > 0 &&
    seleccion.length <= limite &&
    seleccion.every((c) => !c.otorgamientoVigente && compatible(c, grupo)) &&
    (modo === "propio" ||
      (modo === "pedido"
        ? pedido != null && compatible(grupo, pedido)
        : cliente > 0 &&
          (!conPreventa ||
            (preventa != null &&
              preventa.clienteNumero === cliente &&
              preventa.producto === grupo.producto &&
              preventa.campania === Number(grupo.campania?.replace("-", ""))))));
  const limpiar = () => {
    reiniciarPaginas();
    setSeleccion([]);
    setPedido(null);
    setPreventa(null);
    setMensaje("");
    setAdvertencias([]);
    setPlanes([]);
  };
  const cerrarRevision = () => {
    setRevision(null);
    onLockChange(false);
  };
  return (
    <div className="min-w-0 space-y-4">
      <p className="text-sm text-ink-soft">
        Elegí cupos de planta 0 de MacroGest y a quién se los das. La app registra el otorgamiento;
        después pasás el plan en MacroGest y acá queda confirmado cuando se lee.
      </p>
      <fieldset disabled={revision != null} className="min-w-0">
        <PeriodoFiltro
          value={periodo}
          etiqueta="Fecha solicitada de los pedidos"
          onChange={(p) => {
            setPeriodo(p);
            limpiar();
          }}
          onSubmit={(e) => {
            e.preventDefault();
            setFiltros({ ...borrador });
            limpiar();
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
          <FilterActions
            onClear={() => {
              setBorrador(filtrosVacios);
              setFiltros(filtrosVacios);
              limpiar();
            }}
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
      {planes.length > 0 && (
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
              Planta 0 de MacroGest, con fecha de carga de hoy en adelante. Solo lectura.
            </p>
            <TablaLogistica
              titulo="Cupos de planta 0 para otorgar"
              filas={disponibles.data?.pages.flatMap((p) => p.filas) ?? []}
              clave={claveCupo}
              elegida={(f) => seleccion.some((c) => claveCupo(c) === claveCupo(f))}
              cargando={disponibles.isLoading}
              error={disponibles.error}
              reintentar={() => void disponibles.refetch()}
              hayMas={disponibles.hasNextPage}
              mas={() => void disponibles.fetchNextPage()}
              cargandoMas={disponibles.isFetchingNextPage}
              vacio="No hay cupos en planta 0 de hoy en adelante para estos filtros."
              columnas={[
                ...(gestionar
                  ? [
                      {
                        titulo: "Elegir",
                        celda: (f: CupoPlanta0) => (
                          <Elegir
                            tipo="checkbox"
                            etiqueta={`Elegir cupo ${f.codigoTerminal ?? claveCupo(f)}`}
                            checked={seleccion.some((c) => claveCupo(c) === claveCupo(f))}
                            motivo={motivoCupo(f)}
                            onChange={() => {
                              setSeleccion((actual) => {
                                if (actual.some((c) => claveCupo(c) === claveCupo(f)))
                                  return actual.filter((c) => claveCupo(c) !== claveCupo(f));
                                if (motivoCupo(f) != null) return actual;
                                return [...actual, structuredClone(f)];
                              });
                              setPreventa(null);
                              setMensaje("");
                            }}
                          />
                        ),
                      },
                    ]
                  : []),
                { titulo: "Contrato", celda: (f) => f.contrato },
                { titulo: "Plan / cupo", celda: (f) => `${f.plan} / ${f.cupo}` },
                { titulo: "Código otorgado", celda: (f) => f.codigoTerminal || "Sin código" },
                { titulo: "Fecha de carga", celda: (f) => fecha(f.fechaCarga) },
                { titulo: "Destino", celda: (f) => f.destinoNombre ?? f.destinoCodigo ?? "—" },
                { titulo: "Cereal / campaña", celda: (f) => cerealCampania(f) },
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
                              setPedido(structuredClone(f));
                              if (
                                seleccion.some((c) => !compatible(c, f)) ||
                                seleccion.length > f.pendientes
                              ) {
                                setSeleccion([]);
                                setMensaje(
                                  `La selección no coincide con el pedido (pedido ${cerealCampania(f)}, ${f.pendientes} pendientes). Elegí los cupos compatibles.`,
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
                { titulo: "Cereal / campaña", celda: (f) => cerealCampania(f) },
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
        campania={campaniaErp ?? null}
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
            (cliente > 0 && grupo?.producto != null && grupo.campania != null ? (
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
                cupos: seleccion.map((c) => ({ contrato: c.contrato, plan: c.plan, cupo: c.cupo })),
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
              "MacroGest u otro operador cambió los cupos o el pedido. Actualizamos las tablas; elegí nuevamente con los datos actuales.",
            );
          }}
          onSuccess={(resultado) => {
            cerrarRevision();
            limpiar();
            setMensaje(
              `Se otorgaron ${resultado.otorgamientos.length} cupos. Falta pasar el plan en MacroGest; abajo ves cuándo queda confirmado.`,
            );
            setAdvertencias(resultado.advertencias);
            setPlanes(
              resultado.otorgamientos.filter(
                (o, i, todos) =>
                  todos.findIndex((x) => x.contrato === o.contrato && x.plan === o.plan) === i,
              ),
            );
          }}
        />
      )}
      <OtorgamientosRegistrados gestionar={gestionar} bloqueado={revision != null} />
    </div>
  );
}
