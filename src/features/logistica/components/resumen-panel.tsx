import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/shared/components/error-state";
import { KpiCard } from "@/shared/components/kpi-card";
import { FilterActions, FilterField } from "@/shared/components/filter-bar";
import { fecha, periodoInicial } from "../format";
import {
  claveResumen,
  cursorResumen,
  filtrosResumenVacios,
  filtrosResumenValidos,
  paramsResumen,
} from "../lib/resumen";
import { useLogisticaResumen } from "../queries/use-logistica-resumen";
import type { CursorResumen, GrupoResumen, MetricasResumen } from "../types";
import { CatalogoSelect } from "./catalogo-select";
import { DisponiblesPanel } from "./disponibles-panel";
import { PeriodoFiltro } from "./periodo-filtro";
import { TablaLogistica, type Columna } from "./tabla-logistica";
const cantidad = (n: number) => new Intl.NumberFormat("es-AR").format(n);
const solicitudes = (n: number) => `${cantidad(n)} ${n === 1 ? "solicitud" : "solicitudes"}`;
/**
 * Los seis números del circuito, en el orden en que pasan las cosas: lo que pediste, lo que te
 * confirmaron, lo que falta que te entreguen, lo que ya recibiste, lo que queda sin repartir y lo
 * que repartiste. Leídos en fila se ven como un embudo.
 *
 * Antes era una tabla de UNA fila con once columnas numéricas, y abajo otra tabla que repetía esas
 * mismas once por grupo: veintidós números sin jerarquía ni orden de lectura.
 */
function TarjetasResumen({ m }: { m: MetricasResumen }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label="Solicitados"
        value={cantidad(m.solicitados)}
        hint={`En ${solicitudes(m.solicitudes)}${m.cerradas ? ` · ${cantidad(m.cerradas)} cerradas` : ""}`}
      />
      <KpiCard
        label="Confirmados"
        value={m.respuestaVigente === null ? "Sin respuesta" : cantidad(m.respuestaVigente)}
        hint={
          m.sinRespuesta || m.respuestaCero
            ? [
                m.sinRespuesta ? `${solicitudes(m.sinRespuesta)} sin responder` : null,
                m.respuestaCero ? `${cantidad(m.respuestaCero)} con respuesta cero` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "La terminal respondió todo"
        }
      />
      <KpiCard
        label="Por recibir"
        value={m.porRecibir === null ? "Sin respuesta" : cantidad(m.porRecibir)}
        // Con solicitudes sin responder el número es parcial, y decirlo importa: si no, se lee
        // como "falta esto y nada más".
        hint={
          m.porRecibir !== null && m.sinRespuesta > 0
            ? `Parcial: ${solicitudes(m.sinRespuesta)} sin responder`
            : "Confirmados que todavía no cargaste"
        }
      />
      <KpiCard label="Recibidos" value={cantidad(m.recibidos)} hint="Cupos cargados en la app" />
      <KpiCard
        label="Disponibles"
        value={cantidad(m.porOtorgar)}
        hint="Listos para otorgar"
        tone={m.porOtorgar > 0 ? "verde" : "default"}
      />
      <KpiCard
        label="Otorgados"
        value={cantidad(m.otorgados)}
        hint="Ya asignados a un pedido o cliente"
      />
    </div>
  );
}

/** Las excepciones, que son el 90% del ruido y casi siempre cero: sólo se nombran las que pasaron. */
function avisosResumen(m: MetricasResumen): string[] {
  return [
    m.anulados ? `${cantidad(m.anulados)} anulados` : null,
    m.otrosSinOtorgar
      ? `${cantidad(m.otrosSinOtorgar)} sin otorgar que no están disponibles`
      : null,
    m.fechaCargaDistinta ? `${cantidad(m.fechaCargaDistinta)} con carga en otra fecha` : null,
    m.destinoDistinto ? `${cantidad(m.destinoDistinto)} recibidos en otra terminal` : null,
  ].filter((x): x is string => x !== null);
}

const columnasGrupos: Columna<GrupoResumen>[] = [
  { titulo: "Fecha solicitada", celda: (f) => fecha(f.fechaSolicitada) },
  { titulo: "Terminal solicitada", celda: (f) => f.destinoNombre ?? f.destinoCodigo },
  { titulo: "Contrato", celda: (f) => f.contrato },
  { titulo: "Cereal / campaña", celda: (f) => `${f.productoNombre ?? f.producto} / ${f.campania}` },
  { titulo: "Solicitados", numero: true, celda: (f) => cantidad(f.metricas.solicitados) },
  {
    titulo: "Confirmados",
    numero: true,
    celda: (f) =>
      f.metricas.respuestaVigente === null
        ? "Sin respuesta"
        : cantidad(f.metricas.respuestaVigente),
  },
  {
    titulo: "Por recibir",
    numero: true,
    celda: (f) =>
      f.metricas.porRecibir === null ? "Sin respuesta" : cantidad(f.metricas.porRecibir),
  },
  { titulo: "Recibidos", numero: true, celda: (f) => cantidad(f.metricas.recibidos) },
  { titulo: "Disponibles", numero: true, celda: (f) => cantidad(f.metricas.porOtorgar) },
  { titulo: "Otorgados", numero: true, celda: (f) => cantidad(f.metricas.otorgados) },
  {
    // Las excepciones del grupo, nombradas; como columnas eran cuatro ceros por fila.
    titulo: "Avisos",
    celda: (f) => {
      const avisos = avisosResumen(f.metricas);
      return avisos.length ? (
        <span className="text-xs text-ink-soft">{avisos.join(" · ")}</span>
      ) : (
        "—"
      );
    },
  },
];
export function ResumenPanel({ activo }: { activo: boolean }) {
  const [periodo, setPeriodo] = useState(() => periodoInicial());
  const [borrador, setBorrador] = useState(filtrosResumenVacios);
  const [aplicados, setAplicados] = useState(filtrosResumenVacios);
  const [version, setVersion] = useState(0);
  const [cursores, setCursores] = useState<(CursorResumen | undefined)[]>([undefined]);
  const q = useLogisticaResumen(
    paramsResumen(periodo, aplicados),
    cursores[cursores.length - 1],
    version,
    activo,
  );
  const reiniciar = () => {
    setCursores([undefined]);
    setVersion((v) => v + 1);
  };
  const nuevaLectura = q.isSuccess && !q.isFetching && !q.isPlaceholderData && !q.isError;
  const anteriores = !!q.data && !nuevaLectura;
  return (
    <div className="min-w-0 space-y-4">

      {/* Fechas y filtros en la MISMA barra: son los filtros de la misma consulta. */}
      <PeriodoFiltro
        value={periodo}
        etiqueta="Fecha para la que se pidieron los cupos"
        onChange={(p) => {
          setPeriodo(p);
          reiniciar();
        }}
        onSubmit={(e) => {
          e.preventDefault();
          if (filtrosResumenValidos(borrador)) {
            setAplicados({ ...borrador });
            reiniciar();
          }
        }}
      >
        <FilterField label="Contrato">
          <Input
            className="w-40"
            value={borrador.contrato}
            maxLength={15}
            onChange={(e) => setBorrador({ ...borrador, contrato: e.target.value })}
          />
        </FilterField>
        <CatalogoSelect
          className="w-56"
          tipo="productos"
          titulo="Cereal"
          required={false}
          modoFiltro
          value={borrador.producto}
          onChange={(producto) => setBorrador({ ...borrador, producto })}
        />
        <FilterField label="Campaña">
          <Input
            className="w-32"
            value={borrador.campania}
            maxLength={9}
            placeholder="2025-2026"
            onChange={(e) => setBorrador({ ...borrador, campania: e.target.value })}
          />
        </FilterField>
        <CatalogoSelect
          className="w-56"
          tipo="destinos"
          titulo="Terminal solicitada"
          required={false}
          modoFiltro
          value={borrador.destinoCodigo}
          onChange={(destinoCodigo) => setBorrador({ ...borrador, destinoCodigo })}
        />
        <FilterActions
          aplicarDeshabilitado={!filtrosResumenValidos(borrador)}
          onClear={() => {
            setBorrador(filtrosResumenVacios);
            setAplicados(filtrosResumenVacios);
            reiniciar();
          }}
          aviso={
            !filtrosResumenValidos(borrador) && (
              <p role="alert" className="mr-auto text-sm text-rojo">
                Revisá contrato, cereal, campaña y terminal solicitada.
              </p>
            )
          }
        />
      </PeriodoFiltro>
      {/* Lo primero al entrar a Cupos: cuántos hay. Lo de abajo es el seguimiento de lo que se le
          pidió a cada terminal, que es otra pregunta. */}
      <DisponiblesPanel
        periodo={periodo}
        producto={aplicados.producto || undefined}
        campania={aplicados.campania}
        activo={activo}
      />
      <hr className="border-line" />
      {q.isError && !q.data && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      {anteriores && (
        <p role="status" className="text-sm text-ink-soft">
          Datos anteriores. Esperá una consulta exitosa para navegar.
        </p>
      )}
      {/* Mientras se consulta las tablas ya están, vacías: el "Consultando…" vive DENTRO de la
          tarjeta, como en el resto de la app. Suelto arriba empujaba todo para abajo y al llegar la
          respuesta lo devolvía de un salto. Sin lectura NI consulta en curso no se dibujan: el
          mensaje de tabla vacía diría "no hay solicitudes" cuando lo que hubo fue un error. */}
      {(q.data || q.isFetching) && (
        <>
          <div>
            <h2 className="font-display text-xl text-ink">Seguimiento de solicitudes</h2>
            <p className="text-xs text-ink-soft">
              Qué le pediste a cada terminal y en qué terminó. Cuenta sólo los cupos que pasaron por
              una solicitud registrada acá.
            </p>
          </div>
          {q.data ? (
            <>
              <TarjetasResumen m={q.data.totales} />
              {avisosResumen(q.data.totales).length > 0 && (
                <p className="text-sm text-ink-soft">
                  <strong className="font-medium text-ink">Avisos:</strong>{" "}
                  {avisosResumen(q.data.totales).join(" · ")}.
                </p>
              )}
            </>
          ) : (
            <p role="status" className="text-sm text-ink-soft">
              Consultando…
            </p>
          )}
          <h2 className="font-display text-xl text-ink">
            Detalle por fecha, terminal, contrato y cereal
          </h2>
          <TablaLogistica
            titulo="Grupos del resumen"
            filas={q.data?.filas ?? []}
            clave={claveResumen}
            columnas={columnasGrupos}
            cargando={q.isFetching}
            error={q.isError ? q.error : undefined}
            reintentar={() => void q.refetch()}
            vacio={
              q.data && q.data.totales.solicitudes > 0
                ? "No hay más grupos en esta página. Volvé a la página anterior."
                : "No hay solicitudes para estas fechas y filtros."
            }
            // Las páginas son de los grupos, no de los totales: la navegación va al pie de ESA
            // tabla, como en el resto de la app. Suelta al final de la pantalla parecía navegar
            // todo el resumen, incluidos unos totales que no cambian de página.
            pie={
              <div className="no-print flex flex-wrap items-center justify-end gap-3 px-4 py-3 text-sm text-ink-soft">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!nuevaLectura || cursores.length === 1}
                  onClick={() => setCursores((c) => c.slice(0, -1))}
                >
                  <ChevronLeft className="size-4" aria-hidden /> Anterior
                </Button>
                <span className="tabular">Página {cursores.length}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!nuevaLectura || !q.data?.hayMas || !q.data.filas.length}
                  onClick={() => {
                    const ultima = q.data?.filas.at(-1);
                    if (ultima) setCursores((c) => [...c, cursorResumen(ultima)]);
                  }}
                >
                  Siguiente <ChevronRight className="size-4" aria-hidden />
                </Button>
              </div>
            }
          />
        </>
      )}
    </div>
  );
}
