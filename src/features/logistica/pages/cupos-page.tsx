import { CircleOff, History } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toAppError } from "@/lib/api-error";
import { useAuth } from "@/features/auth/auth-context";
import { PageHeader } from "@/shared/components/page-header";
import { fecha, periodoInicial } from "../format";
import { cursorPropio, useDetalle, useListado } from "../queries/use-logistica";
import type { Pedido, Solicitud } from "../types";
import { BotonIcono } from "../components/boton-icono";
import { HistorialDialog } from "../components/historial-dialog";
import { AvisoDemo } from "../components/aviso-demo";
import { PeriodoFiltro } from "../components/periodo-filtro";
import { CerrarSolicitudDialog } from "../components/cerrar-solicitud-dialog";
import { TablaLogistica } from "../components/tabla-logistica";
import { Paginacion } from "../components/paginacion";
import { usePaginacion } from "../lib/paginacion";
import { FiltrosComercialesCampos } from "../components/filtros-comerciales";
import { filtrosComercialesVacios, paramsComerciales } from "../lib/filtros-comerciales";
import { CuposPanel } from "../components/cupos-panel";
import { ContratosVentaPanel } from "../components/contratos-venta-panel";

/**
 * Cupos (decidido el 2026-11-02): los cupos del plan de carga de MacroGest, cada uno con el pedido
 * al que va; el seguimiento de los contratos de venta y el historial de pedidos de cupo a terminal.
 * César carga los cupos una sola vez, en MacroGest, al armar el plan.
 *
 * Desde la fila de un pedido se llega con `?pedido=`: la lista vincula los cupos elegidos a ese
 * pedido.
 */
export function CuposPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Volver de Solicitar abre el historial de pedidos de cupo.
  const { state } = useLocation();
  const [params] = useSearchParams();
  const pedidoId = params.get("pedido");
  const gestionar = user?.roles.includes("logistica-cupos") ?? false;
  const [tab, setTab] = useState((state as { tab?: string } | null)?.tab ?? "cupos");
  const pedido = useDetalle<Pedido>(`pedidos/${pedidoId}`, {}, !!pedidoId);
  const [periodo, setPeriodo] = useState(() => periodoInicial());
  const [cerrarSolicitud, setCerrarSolicitud] = useState<Solicitud | null>(null);
  const [historia, setHistoria] = useState<{
    recurso: string;
    id: string;
    descripcion?: string;
  } | null>(null);
  const [solBorrador, setSolBorrador] = useState(filtrosComercialesVacios);
  const [solComercial, setSolComercial] = useState(solBorrador);
  const solicitudes = useListado<Solicitud>(
    "solicitudes-terminal",
    { ...periodo, ...paramsComerciales(solComercial) },
    cursorPropio,
    tab === "historial",
  );
  // Un tramo por vez, como el resto de la app. El scroll infinito dejaba cientos de filas
  // colgando abajo de los filtros y sin forma de volver.
  const paginaSolicitudes = usePaginacion(solicitudes);
  return (
    <>
      <PageHeader
        title="Cupos"
        subtitle="Los cupos del plan de carga de MacroGest y el pedido al que va cada uno, lo que falta entregar de cada contrato de venta y lo pedido a cada terminal."
      />
      <AvisoDemo />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 max-w-full overflow-x-auto">
          <TabsTrigger value="cupos">Cupos</TabsTrigger>
          <TabsTrigger value="contratos">Contratos de venta</TabsTrigger>
          <TabsTrigger value="historial">Historial de pedidos de cupo</TabsTrigger>
        </TabsList>
        <TabsContent value="cupos">
          {!pedidoId ? (
            <CuposPanel activo={tab === "cupos"} gestionar={gestionar} />
          ) : pedido.data ? (
            <CuposPanel
              key={pedido.data.id}
              activo={tab === "cupos"}
              gestionar={gestionar}
              pedido={pedido.data}
              onVolver={() => void navigate("/logistica/pedidos")}
            />
          ) : pedido.error ? (
            <p role="alert" className="text-sm text-rojo">
              {toAppError(pedido.error).message}
            </p>
          ) : (
            <p className="text-sm text-ink-soft">Cargando el pedido…</p>
          )}
        </TabsContent>
        <TabsContent value="contratos">
          <ContratosVentaPanel activo={tab === "contratos"} />
        </TabsContent>
        <TabsContent value="historial">
          {/* Lo que se le pidió a cada terminal, por si un contrato no se cumple. Solicitar vive
              acá adentro: es la excepción, no el camino de todos los días (devolución 2026-10-23). */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              Los conseguidos se cuentan solos: son los cupos cargados en MacroGest para ese
              contrato con fecha de carga en la fecha pedida.
            </p>
            {gestionar && (
              // Pantalla propia: la grilla de contratos no entra en un modal.
              <Button onClick={() => void navigate("/logistica/cupos/solicitar")}>
                Solicitar cupos
              </Button>
            )}
          </div>
          <PeriodoFiltro
            value={periodo}
            onChange={setPeriodo}
            onSubmit={(e) => {
              e.preventDefault();
              setSolComercial(solBorrador);
            }}
          >
            <FiltrosComercialesCampos
              value={solBorrador}
              onChange={setSolBorrador}
              onClear={() => {
                setSolBorrador(filtrosComercialesVacios);
                setSolComercial(filtrosComercialesVacios);
              }}
            />
          </PeriodoFiltro>
          <TablaLogistica
            titulo="Historial de pedidos de cupo"
            filas={paginaSolicitudes.filas}
            clave={(f) => f.id}
            cargando={solicitudes.isLoading}
            error={solicitudes.error}
            reintentar={() => void solicitudes.refetch()}
            pie={
              <Paginacion
                {...paginaSolicitudes}
                unidad={{ singular: "pedido de cupo", plural: "pedidos de cupo" }}
              />
            }
            vacio="No hay pedidos de cupo a terminal para estas fechas."
            columnas={[
              { titulo: "Contrato", celda: (f) => f.contratoVenta },
              {
                titulo: "Cereal / campaña",
                celda: (f) => `${f.productoNombre ?? f.producto} / ${f.campania}`,
              },
              { titulo: "Fecha solicitada", celda: (f) => fecha(f.fechaSolicitada) },
              { titulo: "Solicitados", numero: true, celda: (f) => f.cantidadCupos },
              {
                titulo: "Conseguidos",
                numero: true,
                celda: (f) => f.conseguidos ?? "Sin verificar",
              },
              {
                titulo: "Faltan",
                numero: true,
                celda: (f) =>
                  f.conseguidos == null ? "—" : Math.max(0, f.cantidadCupos - f.conseguidos),
              },
              { titulo: "Canal", celda: (f) => f.canal },
              { titulo: "Demanda", celda: (f) => (f.cerradaAl ? "Cerrada" : "Abierta") },
              {
                titulo: "Acciones",
                celda: (f) => (
                  <div className="flex gap-1">
                    {gestionar && !f.cerradaAl && (
                      <BotonIcono
                        icono={CircleOff}
                        etiqueta="Cerrar demanda"
                        onClick={() => setCerrarSolicitud(f)}
                      />
                    )}
                    <BotonIcono
                      icono={History}
                      etiqueta="Historial"
                      onClick={() =>
                        setHistoria({
                          recurso: "solicitudes-terminal",
                          id: f.id,
                          descripcion: `Contrato ${f.contratoVenta} · ${f.cantidadCupos} ${f.cantidadCupos === 1 ? "cupo" : "cupos"} para el ${fecha(f.fechaSolicitada)}`,
                        })
                      }
                    />
                  </div>
                ),
              },
            ]}
          />
        </TabsContent>
      </Tabs>
      {cerrarSolicitud && (
        <CerrarSolicitudDialog
          solicitud={cerrarSolicitud}
          onClose={() => setCerrarSolicitud(null)}
        />
      )}
      {historia && <HistorialDialog {...historia} onClose={() => setHistoria(null)} />}
    </>
  );
}
