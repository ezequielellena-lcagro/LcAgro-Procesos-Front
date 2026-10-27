import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { PageHeader } from "@/shared/components/page-header";
import { fecha, periodoInicial } from "../format";
import { cursorPropio, useListado } from "../queries/use-logistica";
import type { Solicitud } from "../types";
import { HistorialDialog } from "../components/historial-dialog";
import { AvisoDemo } from "../components/aviso-demo";
import { PeriodoFiltro } from "../components/periodo-filtro";
import { CerrarSolicitudDialog } from "../components/cerrar-solicitud-dialog";
import { TablaLogistica } from "../components/tabla-logistica";
import { OtorgarPanel } from "../components/otorgar-panel";
import { Paginacion } from "../components/paginacion";
import { usePaginacion } from "../lib/paginacion";
import { FiltrosComercialesCampos } from "../components/filtros-comerciales";
import { filtrosComercialesVacios, paramsComerciales } from "../lib/filtros-comerciales";
import { ResumenPanel } from "../components/resumen-panel";

/**
 * Cupos, con el cupo de MacroGest como única fuente (decisiones del 2026-10-27): Resumen de lo que
 * hay en planta 0, Otorgar contra esos cupos y las solicitudes a terminal al final.
 */
export function CuposPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Volver de Solicitar abre el historial de pedidos de cupo; el botón Otorgar de un pedido abre Otorgar
  // con ese pedido ya elegido.
  const estado = useLocation().state as { tab?: string; pedidoId?: string } | null;
  const solapaInicial = estado?.tab;
  const gestionar = user?.roles.includes("logistica-cupos") ?? false;
  // Resumen es la pantalla de entrada: lo primero que se pidió ver al abrir Cupos es cuánto hay,
  // no el formulario de solicitudes.
  const [tab, setTab] = useState(solapaInicial ?? "resumen");
  const [otorgarLocked, setOtorgarLocked] = useState(false);
  const [periodo, setPeriodo] = useState(() => periodoInicial());
  const [cerrarSolicitud, setCerrarSolicitud] = useState<Solicitud | null>(null);
  const [historia, setHistoria] = useState<{ recurso: string; id: string } | null>(null);
  const [solBorrador, setSolBorrador] = useState(filtrosComercialesVacios);
  const [solComercial, setSolComercial] = useState(filtrosComercialesVacios);
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
        subtitle="Cupos de MacroGest: lo disponible en planta 0, a quién se otorga y lo pedido a cada terminal."
      />
      <AvisoDemo />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (!otorgarLocked) setTab(v);
        }}
      >
        <TabsList className="mb-4 max-w-full overflow-x-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="otorgar">Otorgar</TabsTrigger>
          <TabsTrigger value="historial">Historial de pedidos de cupo</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen">
          <ResumenPanel activo={tab === "resumen"} />
        </TabsContent>
        <TabsContent value="historial">
          {/* Lo que se le pidió a cada terminal, por si un contrato no se cumple. Solicitar vive
              acá adentro: es la excepción, no el camino de todos los días (devolución 2026-10-23). */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              Los conseguidos se cuentan solos: son los cupos que entraron a MacroGest para ese
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
                celda: (f) => (f.conseguidos === null ? "Sin verificar" : f.conseguidos),
              },
              {
                titulo: "Faltan",
                numero: true,
                celda: (f) =>
                  f.conseguidos === null ? "—" : Math.max(0, f.cantidadCupos - f.conseguidos),
              },
              { titulo: "Canal", celda: (f) => f.canal },
              { titulo: "Demanda", celda: (f) => (f.cerradaAl ? "Cerrada" : "Abierta") },
              {
                titulo: "Acciones",
                celda: (f) => (
                  <div className="flex flex-wrap gap-1">
                    {gestionar && !f.cerradaAl && (
                      <Button size="sm" variant="ghost" onClick={() => setCerrarSolicitud(f)}>
                        Cerrar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setHistoria({ recurso: "solicitudes-terminal", id: f.id })}
                    >
                      Historial
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="otorgar">
          <OtorgarPanel
            gestionar={gestionar}
            pedidoInicialId={estado?.pedidoId}
            onLockChange={setOtorgarLocked}
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
