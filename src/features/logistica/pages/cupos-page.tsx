import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { PageHeader } from "@/shared/components/page-header";
import { fecha, fechaInstanteArgentina, kg, periodoInicial } from "../format";
import { cursorPropio, useListado } from "../queries/use-logistica";
import type { Cupo, CupoErp, Solicitud } from "../types";
import { HistorialDialog } from "../components/historial-dialog";
import { AvisoDemo } from "../components/aviso-demo";
import { PeriodoFiltro } from "../components/periodo-filtro";
import { RespuestaDialog } from "../components/solicitud-dialog";
import { TablaLogistica } from "../components/tabla-logistica";
import { OtorgarPanel } from "../components/otorgar-panel";
import { Paginacion } from "../components/paginacion";
import { usePaginacion } from "../lib/paginacion";
import { kgErp } from "../lib/seguimiento";
import { CuposFiltros } from "../components/cupos-filtros";
import { FiltrosComercialesCampos } from "../components/filtros-comerciales";
import { filtrosComercialesVacios, paramsComerciales } from "../lib/filtros-comerciales";
import {
  campaniaValida,
  filtrosCuposVacios,
  paramsCupos,
  paramsCuposErp,
} from "../lib/filtros-cupos";
import { ResumenPanel } from "../components/resumen-panel";

/** Celda sin valor: el guion del resto de la app, no una frase. */
const SIN_DATO = "—";
/**
 * Valor de celda, o guion si no hay.
 *
 * El texto en blanco cuenta como vacío: MacroGest devuelve `''` y no `NULL` en varias columnas
 * de la carta de porte (patente, CTG), y un `?? SIN_DATO` suelto dejaba la celda en blanco.
 */
const oDash = (valor: string | number | null | undefined) =>
  typeof valor === "string" && !valor.trim() ? SIN_DATO : (valor ?? SIN_DATO);
/**
 * Filas por página de la grilla de MacroGest.
 *
 * Es la tabla más ancha de Cupos (trece columnas, con razones sociales que parten en dos
 * renglones): de a 50 obligaba a scrollear hasta perder los filtros de vista. Las demás solapas
 * siguen con el tramo de 50 de `useListado`.
 */
const TRAMO_ERP = 10;
export function CuposPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Volver de una recepción abre la solapa donde quedaron esos cupos, no la de arranque.
  const solapaInicial = (useLocation().state as { tab?: string } | null)?.tab;
  const gestionar = user?.roles.includes("logistica-cupos") ?? false;
  // Resumen es la pantalla de entrada: lo primero que se pidió ver al abrir Cupos es cuánto hay,
  // no el formulario de solicitudes.
  const [tab, setTab] = useState(solapaInicial ?? "resumen");
  const [otorgarInicial, setOtorgarInicial] = useState<Cupo | null>(null);
  const [otorgarLocked, setOtorgarLocked] = useState(false);
  const [periodo, setPeriodo] = useState(() => periodoInicial());
  const [erpPeriodo, setErpPeriodo] = useState(() => periodoInicial());
  const [cuposBorrador, setCuposBorrador] = useState(filtrosCuposVacios);
  const [cuposFiltros, setCuposFiltros] = useState(filtrosCuposVacios);
  const [erpBorrador, setErpBorrador] = useState(filtrosCuposVacios);
  const [erpFiltros, setErpFiltros] = useState(filtrosCuposVacios);
  const [cuposVersion, setCuposVersion] = useState(0);
  const [erpVersion, setErpVersion] = useState(0);
  const reiniciarCupos = () => setCuposVersion((v) => v + 1);
  const reiniciarErp = () => setErpVersion((v) => v + 1);
  const [respuesta, setRespuesta] = useState<{ solicitud: Solicitud; cerrar?: boolean } | null>(
    null,
  );
  const [historia, setHistoria] = useState<{ recurso: string; id: string } | null>(null);
  const [solBorrador, setSolBorrador] = useState(filtrosComercialesVacios);
  const [solComercial, setSolComercial] = useState(filtrosComercialesVacios);
  const solicitudes = useListado<Solicitud>(
    "solicitudes-terminal",
    { ...periodo, ...paramsComerciales(solComercial) },
    cursorPropio,
    tab === "solicitudes",
  );
  const cupos = useListado<Cupo>(
    "cupos",
    { ...periodo, ...paramsCupos(cuposFiltros) },
    (f) => ({ despuesFecha: f.fechaCarga, despuesId: f.id }),
    tab === "recibidos",
    { version: cuposVersion },
  );
  const erp = useListado<CupoErp>(
    "cupos/macrogest",
    { ...erpPeriodo, ...paramsCuposErp(erpFiltros) },
    (f) => ({
      despuesFecha: f.fechaCarga,
      despuesContrato: f.contrato,
      despuesGrupo: f.grupo,
      despuesCupo: f.cupo,
    }),
    tab === "erp",
    { version: erpVersion },
    TRAMO_ERP,
  );
  // Cada grilla muestra UN tramo por vez (50, salvo MacroGest), como el resto de la app. El
  // scroll infinito dejaba cientos de filas colgando abajo de los filtros y sin forma de volver.
  const paginaSolicitudes = usePaginacion(solicitudes);
  const paginaCupos = usePaginacion(cupos);
  const paginaErp = usePaginacion(erp);
  return (
    <>
      <PageHeader
        title="Cupos"
        subtitle="Solicitud a terminal, recepción propia y documentación de MacroGest."
        actions={
          gestionar && (
            <>
              {/* Solicitar es una pantalla propia: la grilla de contratos no entra en un modal.
                  Va como botón y no como enlace para poder bloquearlo mientras hay un otorgamiento
                  sin confirmar, igual que el resto de las acciones de la cabecera. */}
              <Button
                variant="outline"
                disabled={otorgarLocked}
                onClick={() => void navigate("/logistica/cupos/solicitar")}
              >
                Solicitar cupos
              </Button>
              <Button
                disabled={otorgarLocked}
                onClick={() => void navigate("/logistica/cupos/recibir")}
              >
                Recibir cupos
              </Button>
            </>
          )
        }
      />
      <AvisoDemo />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (!otorgarLocked) {
            setOtorgarInicial(null);
            setTab(v);
          }
        }}
      >
        <TabsList className="mb-4 max-w-full overflow-x-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="solicitudes">Solicitudes a terminal</TabsTrigger>
          <TabsTrigger value="recibidos">Cupos recibidos</TabsTrigger>
          <TabsTrigger value="erp">Cupos MacroGest</TabsTrigger>
          <TabsTrigger value="otorgar">Otorgar</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen">
          <ResumenPanel activo={tab === "resumen"} />
        </TabsContent>
        <TabsContent value="solicitudes">
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
            titulo="Solicitudes a terminal"
            filas={paginaSolicitudes.filas}
            clave={(f) => f.id}
            cargando={solicitudes.isLoading}
            error={solicitudes.error}
            reintentar={() => void solicitudes.refetch()}
            pie={
              <Paginacion
                {...paginaSolicitudes}
                unidad={{ singular: "solicitud", plural: "solicitudes" }}
              />
            }
            vacio="Todavía no hay solicitudes para estas fechas. Elegí un contrato de venta para registrar la primera."
            columnas={[
              { titulo: "Contrato", celda: (f) => f.contratoVenta },
              {
                titulo: "Cereal / campaña",
                celda: (f) => `${f.productoNombre ?? f.producto} / ${f.campania}`,
              },
              { titulo: "Destino", celda: (f) => f.destinoNombre ?? f.destinoCodigo },
              { titulo: "Fecha solicitada", celda: (f) => fecha(f.fechaSolicitada) },
              { titulo: "Solicitados", numero: true, celda: (f) => f.cantidadCupos },
              {
                titulo: "Última respuesta",
                numero: true,
                celda: (f) => (f.ultimaRespuesta === null ? "Sin respuesta" : f.ultimaRespuesta),
              },
              { titulo: "Recibidos", numero: true, celda: (f) => f.recibidos },
              { titulo: "Demanda", celda: (f) => (f.cerradaAl ? "Cerrada" : "Abierta") },
              {
                titulo: "Acciones",
                celda: (f) => (
                  <div className="flex flex-wrap gap-1">
                    {gestionar && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRespuesta({ solicitud: f })}
                        >
                          Respuesta
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void navigate(`/logistica/cupos/recibir?solicitud=${f.id}`)
                          }
                        >
                          Recibir
                        </Button>
                        {!f.cerradaAl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRespuesta({ solicitud: f, cerrar: true })}
                          >
                            Cerrar
                          </Button>
                        )}
                      </>
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
        <TabsContent value="recibidos">
          <fieldset disabled={otorgarLocked}>
            <PeriodoFiltro
              value={periodo}
              onChange={(v) => {
                setPeriodo(v);
                reiniciarCupos();
              }}
              etiqueta="Fecha de carga"
              onSubmit={(e) => {
                e.preventDefault();
                if (campaniaValida(cuposBorrador)) {
                  setCuposFiltros({ ...cuposBorrador });
                  reiniciarCupos();
                }
              }}
            >
              <CuposFiltros
                value={cuposBorrador}
                onChange={setCuposBorrador}
                onClear={() => {
                  setCuposBorrador(filtrosCuposVacios);
                  setCuposFiltros(filtrosCuposVacios);
                  reiniciarCupos();
                }}
              />
            </PeriodoFiltro>
          </fieldset>
          <TablaLogistica
            titulo="Cupos recibidos"
            filas={paginaCupos.filas}
            clave={(f) => f.id}
            cargando={cupos.isLoading}
            error={cupos.error}
            reintentar={() => void cupos.refetch()}
            pie={<Paginacion {...paginaCupos} unidad={{ singular: "cupo", plural: "cupos" }} />}
            columnas={[
              { titulo: "Contrato", celda: (f) => f.contratoVenta },
              { titulo: "Fila de tanda", numero: true, celda: (f) => f.ordinal },
              {
                titulo: "Código terminal",
                celda: (f) => f.codigoTerminal || "Pendiente de informar",
              },
              { titulo: "Carga", celda: (f) => fecha(f.fechaCarga) },
              { titulo: "Destino", celda: (f) => f.destinoNombre ?? f.destinoCodigo },
              {
                titulo: "Cereal / campaña",
                celda: (f) => `${f.productoNombre ?? f.producto} / ${f.campania}`,
              },
              { titulo: "Circuito", celda: (f) => f.circuito },
              {
                titulo: "Lugar",
                celda: (f) => `${f.lugarTipo}${f.lugarReferencia ? `: ${f.lugarReferencia}` : ""}`,
              },
              { titulo: "Seguimiento", celda: (f) => f.estadoObservado.replaceAll("_", " ") },
              {
                titulo: "Destinatario",
                celda: (f) =>
                  !f.otorgamientoVigente
                    ? "Sin asignar"
                    : f.otorgamientoVigente.destinatarioTipo === "propio"
                      ? "Propio"
                      : (f.otorgamientoVigente.clienteNombre ??
                        `Cliente ${f.otorgamientoVigente.clienteNumero}`),
              },
              {
                titulo: "Asignación",
                celda: (f) =>
                  f.otorgamientoVigente
                    ? `${fechaInstanteArgentina(f.otorgamientoVigente.vigenteDesde)} · ${kg(f.otorgamientoVigente.kgEstimados)} estimados`
                    : "Pendiente",
              },
              {
                titulo: "Preventa",
                celda: (f) =>
                  f.otorgamientoVigente?.preventa
                    ? `${f.otorgamientoVigente.preventa.operacion} ${f.otorgamientoVigente.preventa.numero}`
                    : "Sin preventa",
              },
              {
                titulo: "Acciones",
                celda: (f) => (
                  <div className="flex flex-wrap gap-1">
                    {gestionar && f.disponibleParaOtorgar && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOtorgarInicial(structuredClone(f));
                          setTab("otorgar");
                        }}
                      >
                        Otorgar a
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setHistoria({ recurso: "cupos", id: f.id })}
                    >
                      Historial
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="erp">
          <fieldset disabled={otorgarLocked}>
            <PeriodoFiltro
              value={erpPeriodo}
              onChange={(v) => {
                setErpPeriodo(v);
                reiniciarErp();
              }}
              etiqueta="Fecha de carga"
              maxDias={31}
              onSubmit={(e) => {
                e.preventDefault();
                setErpFiltros({ ...erpBorrador });
                reiniciarErp();
              }}
            >
              <CuposFiltros
                erp
                value={erpBorrador}
                onChange={setErpBorrador}
                onClear={() => {
                  setErpBorrador(filtrosCuposVacios);
                  setErpFiltros(filtrosCuposVacios);
                  reiniciarErp();
                }}
              />
            </PeriodoFiltro>
          </fieldset>
          <TablaLogistica
            titulo="Cupos de MacroGest"
            filas={paginaErp.filas}
            clave={(f) => `${f.contrato}/${f.grupo}/${f.cupo}`}
            cargando={erp.isLoading}
            error={erp.error}
            reintentar={() => void erp.refetch()}
            pie={<Paginacion {...paginaErp} unidad={{ singular: "cupo", plural: "cupos" }} />}
            columnas={[
              { titulo: "Contrato", celda: (f) => f.contrato },
              { titulo: "Plan de carga / cupo", celda: (f) => `${f.grupo} / ${f.cupo}` },
              { titulo: "Código", celda: (f) => oDash(f.codigoTerminal) },
              { titulo: "Carga", celda: (f) => (f.fechaCarga ? fecha(f.fechaCarga) : SIN_DATO) },
              {
                titulo: "Alta en MacroGest",
                celda: (f) => (f.fechaAltaErp ? fecha(f.fechaAltaErp) : SIN_DATO),
              },
              {
                titulo: "Destino",
                // Denominación en blanco con código cargado: vale más el código que el guion.
                celda: (f) => oDash(f.destinoNombre?.trim() || f.destinoCodigo),
              },
              // Productor, cargador y destino salen de la cabecera del plan: sin cabecera los tres
              // vienen nulos del ERP, así que el guion ya dice todo lo que había para decir.
              { titulo: "Productor del plan", celda: (f) => oDash(f.productorPlan) },
              { titulo: "Cargador del plan", celda: (f) => oDash(f.cargadorPlan) },
              {
                titulo: "Carta de Porte",
                celda: (f) => (f.tieneCartaPorte ? "Presente" : "Pendiente"),
              },
              { titulo: "CTG", celda: (f) => oDash(f.ctg) },
              { titulo: "Patente", celda: (f) => oDash(f.patenteChasis) },
              { titulo: "Kg de carga", numero: true, celda: (f) => kgErp(f.kgCargaErp) },
              { titulo: "Kg de descarga", numero: true, celda: (f) => kgErp(f.kgDescargaErp) },
            ]}
          />
        </TabsContent>
        <TabsContent value="otorgar">
          <OtorgarPanel
            gestionar={gestionar}
            inicial={otorgarInicial}
            onLockChange={setOtorgarLocked}
          />
        </TabsContent>
      </Tabs>
      {respuesta && (
        <RespuestaDialog
          solicitud={respuesta.solicitud}
          cerrarSolicitud={respuesta.cerrar}
          onClose={() => setRespuesta(null)}
        />
      )}
      {historia && <HistorialDialog {...historia} onClose={() => setHistoria(null)} />}
    </>
  );
}
