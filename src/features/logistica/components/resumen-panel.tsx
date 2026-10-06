import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/shared/components/error-state";
import { FilterField } from "@/shared/components/filter-bar";
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
import { PeriodoFiltro } from "./periodo-filtro";
import { TablaLogistica, type Columna } from "./tabla-logistica";
const cantidad = (n: number) => new Intl.NumberFormat("es-AR").format(n);
const solicitudes = (n: number) => `${cantidad(n)} ${n === 1 ? "solicitud" : "solicitudes"}`;
function Contexto({ children }: { children: ReactNode }) {
  return <div className="mt-1 text-xs text-ink-soft">{children}</div>;
}
const columnasMetricas: Columna<MetricasResumen>[] = [
  {
    titulo: "Solicitudes",
    numero: true,
    celda: (m) => (
      <>
        {cantidad(m.solicitudes)}
        <Contexto>{cantidad(m.cerradas)} cerradas</Contexto>
      </>
    ),
  },
  { titulo: "Solicitados", numero: true, celda: (m) => cantidad(m.solicitados) },
  {
    titulo: "Respuesta vigente",
    numero: true,
    celda: (m) => (
      <>
        {m.respuestaVigente === null ? "Sin respuesta" : cantidad(m.respuestaVigente)}
        {m.sinRespuesta > 0 && <Contexto>{solicitudes(m.sinRespuesta)} sin respuesta</Contexto>}
        {m.respuestaCero > 0 && (
          <Contexto>{solicitudes(m.respuestaCero)} con respuesta cero</Contexto>
        )}
      </>
    ),
  },
  { titulo: "Recibidos", numero: true, celda: (m) => cantidad(m.recibidos) },
  { titulo: "Otorgados", numero: true, celda: (m) => cantidad(m.otorgados) },
  {
    titulo: "Por recibir",
    numero: true,
    celda: (m) => (
      <>
        {m.porRecibir === null ? "Sin respuesta" : cantidad(m.porRecibir)}
        {m.sinRespuesta > 0 && m.porRecibir !== null && (
          <Contexto>Parcial: {solicitudes(m.sinRespuesta)} sin respuesta</Contexto>
        )}
      </>
    ),
  },
  {
    titulo: "Por otorgar",
    numero: true,
    celda: (m) => (
      <>
        {cantidad(m.porOtorgar)}
        <Contexto>Disponibles</Contexto>
      </>
    ),
  },
  {
    titulo: "Otros sin otorgar",
    numero: true,
    celda: (m) => (
      <>
        {cantidad(m.otrosSinOtorgar)}
        <Contexto>No disponibles</Contexto>
      </>
    ),
  },
  { titulo: "Anulados", numero: true, celda: (m) => cantidad(m.anulados) },
  { titulo: "Carga con otra fecha", numero: true, celda: (m) => cantidad(m.fechaCargaDistinta) },
  { titulo: "Recepción en otra terminal", numero: true, celda: (m) => cantidad(m.destinoDistinto) },
];
const columnasGrupos: Columna<GrupoResumen>[] = [
  { titulo: "Fecha solicitada", celda: (f) => fecha(f.fechaSolicitada) },
  { titulo: "Terminal solicitada", celda: (f) => f.destinoNombre ?? f.destinoCodigo },
  { titulo: "Contrato", celda: (f) => f.contrato },
  { titulo: "Cereal / campaña", celda: (f) => `${f.productoNombre ?? f.producto} / ${f.campania}` },
  ...columnasMetricas.map((c) => ({ ...c, celda: (f: GrupoResumen) => c.celda(f.metricas) })),
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
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" disabled={!filtrosResumenValidos(borrador)}>
            Aplicar filtros
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setBorrador(filtrosResumenVacios);
              setAplicados(filtrosResumenVacios);
              reiniciar();
            }}
          >
            Limpiar filtros
          </Button>
        </div>
        {!filtrosResumenValidos(borrador) && (
          <p role="alert" className="basis-full text-sm text-rojo">
            Revisá contrato, cereal, campaña y terminal solicitada.
          </p>
        )}
      </PeriodoFiltro>
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
          <h2 className="font-medium">Totales de la selección completa</h2>
          <TablaLogistica
            titulo="Totales del resumen"
            filas={q.data ? [q.data.totales] : []}
            clave={() => "totales"}
            columnas={columnasMetricas}
            cargando={q.isFetching}
            vacio="Todavía no se consultó el resumen."
          />
          <h2 className="font-medium">Grupos por fecha, terminal, contrato y cereal / campaña</h2>
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
