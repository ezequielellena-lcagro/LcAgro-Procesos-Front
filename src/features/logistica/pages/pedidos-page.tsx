import { History, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { fecha, periodoInicial } from "../format";
import { cursorPropio, useListado, useOperacion } from "../queries/use-logistica";
import type { Pedido, Preventa } from "../types";
import { AvisoDemo } from "../components/aviso-demo";
import { PreventaPicker } from "../components/contrato-picker";
import { FormOperacionFooter } from "../components/form-operacion";
import { BotonIcono } from "../components/boton-icono";
import { HistorialDialog } from "../components/historial-dialog";
import { PedidoHace, Vencimiento } from "../components/vencimiento";
import { usePaginacion } from "../lib/paginacion";
import { Paginacion } from "../components/paginacion";
import { PedidoDialog } from "../components/pedido-dialog";
import { PeriodoFiltro } from "../components/periodo-filtro";
import { FiltrosComercialesCampos } from "../components/filtros-comerciales";
import { filtrosComercialesVacios, paramsComerciales } from "../lib/filtros-comerciales";
import { TablaLogistica } from "../components/tabla-logistica";

const otrosVacios = { preventaNumero: "", cumplidos: false };

export function PedidosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const gestionar = user?.roles.includes("logistica-pedidos") ?? false;
  // Vincular cupos es operación de Cupos: el botón de la fila sólo aparece con ese permiso.
  const otorgar = user?.roles.includes("logistica-cupos") ?? false;
  const [tab, setTab] = useState("agenda");
  const [periodo, setPeriodo] = useState(() => periodoInicial());
  const [historia, setHistoria] = useState<Pedido | null>(null);
  const [dialogo, setDialogo] = useState<{ pedido?: Pedido; preventa?: Preventa } | null>(null);
  const [eliminar, setEliminar] = useState<Pedido | null>(null);
  const [preventa, setPreventa] = useState<Preventa | null>(null);
  const [borrador, setBorrador] = useState(filtrosComercialesVacios);
  const [comercial, setComercial] = useState(borrador);
  const [otrosBorrador, setOtrosBorrador] = useState(otrosVacios);
  const [otros, setOtros] = useState(otrosVacios);
  // Por fecha del pedido o por prioridad de entrega (a quién se le debe hace más tiempo); se elige
  // tocando el encabezado de «Para cuándo» o de «Le debemos hace».
  const [orden, setOrden] = useState<"fecha" | "prioridad">("fecha");
  // Un pedido con todo otorgado sale de la lista; «Ver cumplidos» muestra sólo esos.
  const q = useListado<Pedido>(
    "pedidos",
    {
      ...periodo,
      ...paramsComerciales(comercial),
      preventaNumero: otros.preventaNumero.trim() || undefined,
      ...(otros.cumplidos ? { cumplidos: true } : { soloPendientes: true }),
      orden,
    },
    cursorPropio,
  );
  const paginacion = usePaginacion(q);
  return (
    <>
      <PageHeader
        title="Pedidos"
        subtitle="Demanda de productores y preventas de referencia."
        actions={
          gestionar &&
          // Con una preventa elegida en la solapa del ERP, el alta de arriba pasa a ser la de esa
          // preventa: el botón al pie de la grilla quedaba fuera de la vista al scrollear. Al lado
          // va cómo soltarla, porque si no el alta libre queda tapada hasta recargar la página.
          (tab === "erp" && preventa ? (
            <>
              <Button variant="outline" onClick={() => setPreventa(null)}>
                <X className="size-4" aria-hidden /> Quitar selección
              </Button>
              <Button onClick={() => setDialogo({ preventa })}>
                <Plus className="size-4" aria-hidden /> Crear pedido con {preventa.operacion}{" "}
                {preventa.numero}
              </Button>
            </>
          ) : (
            <Button onClick={() => setDialogo({})}>
              <Plus className="size-4" aria-hidden /> Nuevo pedido
            </Button>
          ))
        }
      />
      <AvisoDemo />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="agenda">Pedidos de Logística</TabsTrigger>
          <TabsTrigger value="erp">Preventas MacroGest</TabsTrigger>
        </TabsList>
        <TabsContent value="agenda">
          <PeriodoFiltro
            value={periodo}
            onChange={setPeriodo}
            onSubmit={(e) => {
              e.preventDefault();
              setComercial(borrador);
              setOtros(otrosBorrador);
            }}
          >
            <FilterField label="N° de orden de la preventa">
              <Input
                className="w-44"
                maxLength={15}
                value={otrosBorrador.preventaNumero}
                onChange={(e) =>
                  setOtrosBorrador({ ...otrosBorrador, preventaNumero: e.target.value })
                }
              />
            </FilterField>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={otrosBorrador.cumplidos}
                onChange={(e) =>
                  setOtrosBorrador({ ...otrosBorrador, cumplidos: e.target.checked })
                }
              />
              Ver cumplidos
            </label>
            <FiltrosComercialesCampos
              value={borrador}
              onChange={setBorrador}
              onClear={() => {
                setBorrador(filtrosComercialesVacios);
                setComercial(filtrosComercialesVacios);
                setOtrosBorrador(otrosVacios);
                setOtros(otrosVacios);
              }}
            />
          </PeriodoFiltro>
          <TablaLogistica
            titulo="Pedidos de Logística"
            filas={paginacion.filas}
            clave={(f) => f.id}
            cargando={q.isLoading}
            error={q.error}
            reintentar={() => void q.refetch()}
            vacio={
              otros.cumplidos
                ? "No hay pedidos cumplidos para estas fechas y filtros."
                : "Todavía no hay pedidos pendientes para estas fechas. Registrá el primer pedido del productor."
            }
            pie={<Paginacion {...paginacion} unidad={{ singular: "pedido", plural: "pedidos" }} />}
            // Siete columnas y no doce: cada una junta un dato principal con su detalle debajo
            // (preventa + vencimiento, cereal + campaña + carga, fecha + antigüedad, cupos). Con
            // doce, el productor se partía en tres renglones y la fila no se leía de un vistazo.
            columnas={[
              {
                titulo: "Productor",
                celda: (f) => (
                  <div className="min-w-40">
                    <span className="font-medium">{f.clienteNombre ?? "Nombre no disponible"}</span>
                    <div className="text-xs text-ink-soft">Cliente {f.clienteNumero}</div>
                  </div>
                ),
              },
              {
                titulo: "Preventa",
                // Debajo, el fin del período de entrega (MacroGest); ordena por la que venció antes.
                celda: (f) =>
                  f.preventa ? (
                    <>
                      <span className="whitespace-nowrap font-medium">
                        {`${f.preventa.operacion} ${f.preventa.numero}`}
                      </span>
                      <div className="text-xs">
                        <Vencimiento hasta={f.preventaEntregaHasta} />
                      </div>
                    </>
                  ) : (
                    <span className="text-ink-soft">Sin preventa</span>
                  ),
                orden: { activo: orden === "prioridad", ordenar: () => setOrden("prioridad") },
              },
              {
                titulo: "Cereal",
                celda: (f) => (
                  <>
                    <span className="font-medium">{f.productoNombre ?? f.producto}</span>
                    <div className="whitespace-nowrap text-xs text-ink-soft">
                      {f.campania} · <span>{f.seCargaEnPlanta ? "En planta" : "En campo"}</span>
                    </div>
                  </>
                ),
              },
              {
                titulo: "Para cuándo",
                celda: (f) => (
                  <>
                    <span className="whitespace-nowrap font-medium">
                      {fecha(f.fechaSolicitada)}
                    </span>
                    <div className="text-xs text-ink-soft">
                      <PedidoHace desde={f.creadoAl} />
                    </div>
                  </>
                ),
                orden: { activo: orden === "fecha", ordenar: () => setOrden("fecha") },
              },
              { titulo: "Cupos", celda: (f) => <CuposPedido pedido={f} /> },
              { titulo: "Estado", celda: (f) => <EstadoPedido estado={f.estado} /> },
              {
                titulo: "Acciones",
                celda: (f) => (
                  <div className="flex gap-1">
                    {otorgar && f.pendientes > 0 && (
                      <BotonIcono
                        icono={Link2}
                        etiqueta="Vincular cupos"
                        variant="default"
                        onClick={() => void navigate(`/logistica/cupos?pedido=${f.id}`)}
                      />
                    )}
                    {gestionar && (
                      <>
                        <BotonIcono
                          icono={Pencil}
                          etiqueta="Corregir"
                          onClick={() => setDialogo({ pedido: f })}
                        />
                        <BotonIcono
                          icono={Trash2}
                          etiqueta="Eliminar"
                          className="text-rojo"
                          onClick={() => setEliminar(f)}
                        />
                      </>
                    )}
                    <BotonIcono
                      icono={History}
                      etiqueta="Historial"
                      onClick={() => setHistoria(f)}
                    />
                  </div>
                ),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="erp">
          {/* Diez filas: la grilla entra entera en pantalla y no tapa los filtros al scrollear. */}
          <PreventaPicker selected={preventa} onSelect={setPreventa} tamano={10} />
        </TabsContent>
      </Tabs>
      {dialogo && (
        <PedidoDialog
          pedido={dialogo.pedido}
          preventaInicial={dialogo.preventa}
          onClose={() => setDialogo(null)}
        />
      )}
      {eliminar && <EliminarPedidoDialog pedido={eliminar} onClose={() => setEliminar(null)} />}
      {historia && (
        <HistorialDialog
          recurso="pedidos"
          id={historia.id}
          descripcion={`${historia.clienteNombre ?? `Cliente ${historia.clienteNumero}`} · ${historia.cantidadCupos} ${historia.cantidadCupos === 1 ? "cupo" : "cupos"} para el ${fecha(historia.fechaSolicitada)}`}
          onClose={() => setHistoria(null)}
        />
      )}
    </>
  );
}

/**
 * Solicitados, otorgados y pendientes en una sola celda: «0 de 1 otorgados» con una barra de
 * avance y lo que falta debajo. Eran tres columnas de números sueltos que había que sumar a ojo.
 */
function CuposPedido({ pedido }: { pedido: Pedido }) {
  const { cantidadCupos: pide, otorgados, pendientes } = pedido;
  const avance = pide > 0 ? Math.min(100, (otorgados / pide) * 100) : 0;
  return (
    <div className="min-w-32">
      <div className="whitespace-nowrap tabular-nums">
        <strong>{otorgados}</strong> de {pide} {pide === 1 ? "otorgado" : "otorgados"}
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label="Cupos otorgados"
        aria-valuemin={0}
        aria-valuemax={pide}
        aria-valuenow={otorgados}
      >
        <div className="h-full rounded-full bg-verde" style={{ width: `${avance}%` }} />
      </div>
      {pendientes > 0 && (
        <div className="mt-1 text-xs text-ink-soft tabular-nums">
          Faltan {pendientes} {pendientes === 1 ? "cupo" : "cupos"}
        </div>
      )}
    </div>
  );
}

const TONO_ESTADO: Record<string, string> = {
  pendiente: "border-clementina-deep/40 bg-clementina/15 text-ink",
  parcial: "border-slate-soft bg-secondary text-ink",
  atendido: "border-verde/30 bg-verde-bg text-verde",
};

/** El estado como etiqueta de color: en texto plano se perdía entre los números de la fila. */
function EstadoPedido({ estado }: { estado: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
        TONO_ESTADO[estado] ?? "border-line bg-panel-soft text-ink"
      }`}
    >
      {estado}
    </span>
  );
}

/**
 * Eliminar un pedido. Con cupos otorgados se bloquea y dice cuántos: un pedido asignado borrado
 * sin querer era justo lo que el área usuaria pidió evitar. Hay que desvincular esos cupos antes,
 * desde Cupos.
 */
function EliminarPedidoDialog({ pedido, onClose }: { pedido: Pedido; onClose: () => void }) {
  const mutation = useOperacion<Pedido>(`pedidos/${pedido.id}/eliminar`);
  const bloqueado = pedido.otorgados > 0;
  return (
    <Modal open title="Eliminar pedido" onClose={() => !mutation.isPending && onClose()}>
      <p className="mb-3 text-sm text-ink">
        {pedido.clienteNombre ?? `Cliente ${pedido.clienteNumero}`} · {pedido.cantidadCupos} cupos
        para el {fecha(pedido.fechaSolicitada)}
        {pedido.preventa ? ` · ${pedido.preventa.operacion} ${pedido.preventa.numero}` : ""}.
      </p>
      {bloqueado ? (
        <>
          <p role="alert" className="text-sm text-rojo">
            Este pedido tiene {pedido.otorgados}{" "}
            {pedido.otorgados === 1 ? "cupo otorgado" : "cupos otorgados"}. Desvinculá esos cupos en
            Cupos antes de eliminarlo.
          </p>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await mutation.mutateAsync({ revision: pedido.revision });
              onClose();
            } catch {
              // El pie muestra el error del servidor.
            }
          }}
        >
          <p className="text-sm text-ink-soft">
            El pedido se borra de la lista. La eliminación queda registrada en la historia de
            Logística.
          </p>
          <FormOperacionFooter
            error={mutation.error}
            pending={mutation.isPending}
            onClose={onClose}
            texto="Eliminar pedido"
          />
        </form>
      )}
    </Modal>
  );
}
