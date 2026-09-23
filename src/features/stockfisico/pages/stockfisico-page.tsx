import { useState, type ReactNode } from "react";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { DataTable, type Column } from "@/shared/components/data-table";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { Pagination, type UnidadPaginacion } from "@/shared/components/pagination";
import { fecha as fmtFecha, numero, oDash } from "@/shared/format/format";
import { FijacionBadge } from "../components/fijacion-badge";
import { FijacionVencidaCard } from "../components/fijacion-vencida-card";
import { PorCompradorCard } from "../components/por-comprador-card";
import { TotalesPorPlanta } from "../components/totales-por-planta";
import { porExportador, porRiesgo, type GrupoAFijar } from "../lib/a-fijar";
import {
  cerealesDe,
  filtrarPorCereal,
  filtrarPorVencimiento,
  OPCIONES_VENCIMIENTO,
  type FiltroVencimiento,
} from "../lib/filtros";
import { useStockCereal } from "../queries/use-stock-cereal";
import { useStockCerealExport } from "../queries/use-stock-cereal-export";
import type { AFijarDetalleDto, AlertaDescargaDto, ConsolidadoCerealDto, StockCerealDto } from "../types";

const campLabel = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

/**
 * Las cinco vistas de la pantalla: la foto de la existencia, el resumen de lo que hay que fijar,
 * sus dos detalles (por contrato y por con quién se gestiona) y el control de carga.
 */
type TabStockFisico = "existencia" | "resumen" | "contrato" | "exportador" | "revisar";

/** Solapas que el filtro de vencimiento acota. En las otras el control se muestra deshabilitado. */
const TABS_CON_VENCIMIENTO: TabStockFisico[] = ["resumen", "contrato", "exportador"];

/** Filas por página de las tablas del detalle. Se paginan en el cliente: el reporte viene entero. */
const PAGE_SIZE = 25;

const CONTRATOS: UnidadPaginacion = { singular: "contrato", plural: "contratos" };
const GRUPOS: UnidadPaginacion = { singular: "exportador o corredor", plural: "exportadores y corredores" };

/**
 * Tabla del detalle con paginación de cliente.
 *
 * El `footer` que recibe es el total de TODAS las filas, no el de la página: por eso el pie de la
 * paginación lo aclara. Las columnas no se ordenan por encabezado (a diferencia del consolidado):
 * con la tabla paginada, el orden solo alcanzaría a las filas visibles y mentiría. El orden de
 * negocio —riesgo de fijación primero— lo fija quien arma las filas.
 */
function TablaPaginada<T>({
  columns,
  rows,
  getRowKey,
  footer,
  empty,
  unidad,
  page,
  onPage,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string | number;
  footer?: ReactNode[];
  empty: string;
  unidad: UnidadPaginacion;
  page: number;
  onPage: (p: number) => void;
}) {
  const total = rows.length;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  // Al cambiar de filtro la página elegida puede quedar fuera de rango: se cae a la última.
  const pageSafe = Math.min(page, totalPages);
  const visibles = rows.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={columns}
        rows={visibles}
        getRowKey={getRowKey}
        footer={footer}
        empty={empty}
      />
      {total > PAGE_SIZE && (
        <Pagination
          page={pageSafe}
          totalPages={totalPages}
          total={total}
          onPage={onPage}
          unidad={unidad}
          detalle="el TOTAL del pie suma todas las páginas"
        />
      )}
    </>
  );
}

export function StockFisicoPage() {
  // La campaña se resuelve en el backend (filtra las cuatro componentes, incluida la planilla de
  // silobolsa del año); cereal y vencimiento son filtros de lectura sobre el reporte ya traído.
  const [campania, setCampania] = useState("");
  const [cerealSel, setCerealSel] = useState("");
  const [vencimiento, setVencimiento] = useState<FiltroVencimiento>("");
  // Abre en el resumen del a fijar, que es la cola de trabajo; la existencia queda a un clic.
  const [tab, setTab] = useState<TabStockFisico>("resumen");
  // Una sola página para las tablas: cambiar de solapa o de filtro vuelve a la primera.
  const [page, setPage] = useState(1);

  const query = useStockCereal(campania || undefined);
  const exportar = useStockCerealExport();

  const cereales = query.data ? cerealesDe(query.data) : [];
  // Derivado: si al cambiar de campaña el cereal elegido ya no tiene stock, se vuelve a "Todos"
  // en vez de dejar la pantalla vacía sin explicación.
  const cereal = cereales.includes(cerealSel) ? cerealSel : "";
  const data = query.data ? filtrarPorCereal(query.data, cereal) : undefined;

  // Los derivados del a fijar se calculan acá y no adentro del reporte porque la barra de solapas
  // —que va arriba de todo, incluso mientras carga— muestra su conteo.
  const planta10 = data ? filtrarPorVencimiento(data.detallePlanta10, vencimiento) : [];
  const grupos = porExportador(planta10);
  const alertas = data?.alertasDescarga.length ?? 0;
  const filtroAplica = TABS_CON_VENCIMIENTO.includes(tab);
  /** Sin datos todavía no hay número que mostrar: el label va solo. */
  const conteo = (n: number) => (data ? ` (${n})` : "");

  const cambiarTab = (v: TabStockFisico) => {
    setTab(v);
    setPage(1);
  };
  const cambiarVencimiento = (v: FiltroVencimiento) => {
    setVencimiento(v);
    setPage(1);
  };
  const cambiarCereal = (v: string) => {
    setCerealSel(v);
    setPage(1);
  };
  const cambiarCampania = (v: string) => {
    setCampania(v);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Stock Físico de Cereal"
        subtitle={
          query.data
            ? `Existencia de grano propio por cereal · ${campania ? `campaña ${campania}` : "todas las campañas"} · al ${fmtFecha(query.data.fecha)}`
            : "Existencia de grano propio por cereal"
        }
        actions={
          <ExportButtons
            onExcel={() => exportar.mutate(campania || undefined)}
            excelLoading={exportar.isPending}
            excelDisabled={!query.data}
          />
        }
      />

      {/* Orden fijo, el mismo de las demás pantallas: solapas → filtros → contenido. La barra de
          filtros va DENTRO del Tabs porque depende de la solapa activa (el vencimiento no aplica en
          todas), y se dibuja también mientras carga o si la consulta falla: el error no te deja sin
          filtros. */}
      <Tabs value={tab} onValueChange={cambiarTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="existencia">Existencia</TabsTrigger>
          <TabsTrigger value="resumen">A fijar · resumen</TabsTrigger>
          <TabsTrigger value="contrato">Por contrato{conteo(planta10.length)}</TabsTrigger>
          <TabsTrigger value="exportador">Por exportador{conteo(grupos.length)}</TabsTrigger>
          <TabsTrigger value="revisar">
            {/* El conteo va en el label porque la solapa esconde lo que no está activa. Cuando hay
                algo que corregir va en rojo sólido: es trabajo de carga pendiente en MacroGest, y
                se tiene que ver desde cualquier solapa. */}
            A revisar
            {alertas > 0 ? (
              <span className="ml-1 rounded-full bg-rojo px-1.5 py-0.5 text-xs font-semibold text-white">
                {alertas}
              </span>
            ) : (
              conteo(alertas)
            )}
          </TabsTrigger>
        </TabsList>

        <FilterBar>
          <FilterField label="Campaña">
            <CampaniaSelect
              value={campania}
              campanias={query.data?.campanias}
              onChange={cambiarCampania}
              disabled={query.isPending}
              todasLabel="Todas"
            />
          </FilterField>
          <FilterField label="Cereal">
            <Select
              value={cereal}
              onChange={(e) => cambiarCereal(e.target.value)}
              disabled={cereales.length === 0}
            >
              <option value="">Todos</option>
              {cereales.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FilterField>
          {/* Deshabilitado en vez de oculto en Existencia y A revisar: si desapareciera seguiría
              filtrando en silencio a las otras solapas, y la barra cambiaría de tamaño al navegar. */}
          <FilterField
            label="Vto. de fijación"
            title={
              filtroAplica
                ? "Acota el a fijar de planta 10: el grano no deja de estar en la planta porque su fijación venza más adelante."
                : "Esta solapa no depende del vencimiento de fijación: el filtro sigue aplicado en las solapas del a fijar."
            }
          >
            <Select
              value={vencimiento}
              disabled={!filtroAplica}
              onChange={(e) => cambiarVencimiento(e.target.value as FiltroVencimiento)}
            >
              {OPCIONES_VENCIMIENTO.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>

        {(cereal || vencimiento) && (
          <p className="-mt-2 mb-4 text-xs text-ink-soft">
            Cereal y vencimiento filtran lo que se ve en pantalla; el Excel se descarga con la campaña
            completa.
          </p>
        )}

        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : data ? (
          <Reporte data={data} planta10={planta10} grupos={grupos} page={page} onPage={setPage} />
        ) : (
          <Cargando />
        )}
      </Tabs>
    </div>
  );
}

function Reporte({
  data,
  planta10,
  grupos,
  page,
  onPage,
}: {
  data: StockCerealDto;
  /** Planta 10 ya acotada por cereal y por vencimiento: es lo que se ve. */
  planta10: AFijarDetalleDto[];
  grupos: GrupoAFijar[];
  page: number;
  onPage: (p: number) => void;
}) {
  const t = data.totales;
  const planta10Tn = planta10.reduce((acc, d) => acc + d.aFijarTn, 0);

  // Esta tabla no pagina (una fila por cereal), así que sí se ordena por encabezado: `sortBy`
  // devuelve el valor crudo para que "12.283" no se ordene como texto. El tercer clic devuelve el
  // orden original. Las del detalle no lo llevan, ver `TablaPaginada`.
  const consolidadoCols: Column<ConsolidadoCerealDto>[] = [
    { key: "cereal", header: "Cereal", cell: (r) => r.cereal, sortBy: (r) => r.cereal },
    { key: "p15", header: "P15 Acopio", align: "right", cell: (r) => numero(r.p15), sortBy: (r) => r.p15 },
    { key: "p20", header: "P20 Semillero", align: "right", cell: (r) => numero(r.p20), sortBy: (r) => r.p20 },
    { key: "p10", header: "P10 A fijar", align: "right", cell: (r) => numero(r.p10), sortBy: (r) => r.p10 },
    { key: "bolsa", header: "Silobolsa", align: "right", cell: (r) => numero(r.silobolsa), sortBy: (r) => r.silobolsa },
    { key: "total", header: "Total", align: "right", cell: (r) => numero(r.total), sortBy: (r) => r.total },
  ];

  const detalleCols: Column<AFijarDetalleDto>[] = [
    { key: "comprador", header: "Comprador", cell: (r) => r.comprador },
    { key: "cereal", header: "Cereal", cell: (r) => r.cereal },
    { key: "contrato", header: "Contrato", cell: (r) => r.contrato },
    { key: "campania", header: "Campaña", cell: (r) => campLabel(r.campania) },
    { key: "afijar", header: "A fijar (tn)", align: "right", cell: (r) => numero(r.aFijarTn) },
    { key: "via", header: "Vía", cell: (r) => (r.directo ? "Directo" : "Corredor") },
    { key: "vto", header: "Vto. fijación", align: "right", cell: (r) => oDash(r.vtoFijacion, fmtFecha) },
    { key: "estado", header: "Estado", cell: (r) => <FijacionBadge estado={r.estado} /> },
  ];

  const grupoCols: Column<GrupoAFijar>[] = [
    { key: "cereal", header: "Cereal", cell: (g) => g.cereal },
    { key: "exportador", header: "Exportador", cell: (g) => g.exportador },
    {
      key: "via",
      header: "Vía",
      cell: (g) =>
        g.esDirecto ? <span className="text-ink-soft">Directo</span> : g.via,
    },
    { key: "contratos", header: "Contratos", align: "right", cell: (g) => g.contratos },
    { key: "tn", header: "A fijar (tn)", align: "right", cell: (g) => numero(g.tn) },
    { key: "vto", header: "Próx. vto.", align: "right", cell: (g) => oDash(g.proximoVto, fmtFecha) },
    { key: "estado", header: "Estado", cell: (g) => <FijacionBadge estado={g.estado} /> },
  ];

  const alertaCols: Column<AlertaDescargaDto>[] = [
    { key: "contrato", header: "Contrato", cell: (r) => r.contrato },
    { key: "comprador", header: "Comprador", cell: (r) => r.comprador },
    { key: "cereal", header: "Cereal", cell: (r) => r.cereal },
    { key: "campania", header: "Campaña", cell: (r) => campLabel(r.campania) },
    { key: "fijado", header: "Fijado (tn)", align: "right", cell: (r) => numero(r.fijadoTn) },
  ];

  return (
    <>
      <TabsContent value="existencia" className="space-y-4">
        {/* Los totales viven acá y en el pie de la tabla, no en una tira de KPIs arriba de todo:
            son el total de ESTA solapa. */}
        <TotalesPorPlanta
          items={[
            { titulo: "Planta 15", subtitulo: "Acopio San Jorge", tn: t.p15 },
            { titulo: "Planta 20", subtitulo: "Semillero", tn: t.p20 },
            { titulo: "Planta 10", subtitulo: "Entregado a fijar", tn: t.p10 },
            {
              titulo: "Silobolsa",
              // Cuando el embolsado todavía no se carga, la aclaración va acá y no en un aviso
              // aparte: es el único lugar donde el 0 se puede leer mal.
              subtitulo: data.silobolsaPendiente ? "Pendiente de carga" : "Embolsado en campo",
              title: data.silobolsaPendiente
                ? "La silobolsa (grano embolsado en campo) se carga por otra vía; hoy figura en 0."
                : undefined,
              tn: t.silobolsa,
            },
            { titulo: "Total físico", subtitulo: "Las cuatro componentes", tn: t.total, acento: true },
          ]}
        />

        {data.campania && data.plantasOtrasCampaniasTn !== 0 && (
          <p className="rounded-card border border-line bg-panel-soft px-4 py-2 text-sm text-ink-soft">
            Quedan <strong>{numero(data.plantasOtrasCampaniasTn)} tn</strong> de plantas 15/20 imputadas
            a otras campañas, fuera de este filtro. MacroGest imputa el saldo de planta a la campaña del
            movimiento, así que arrastra residuos de años anteriores —y pueden ser negativos, cuando el
            grano entró imputado a un año y salió imputado a otro—. Sin filtro de campaña el total los
            incluye: ese es el número que se concilia con Acopio.
          </p>
        )}

        <section>
          <h2 className="mb-2 font-display text-lg font-semibold text-ink">
            Consolidado por cereal y planta — tn
          </h2>
          <DataTable
            columns={consolidadoCols}
            rows={data.consolidado}
            getRowKey={(r) => r.cereal}
            footer={[
              "TOTAL",
              numero(t.p15),
              numero(t.p20),
              numero(t.p10),
              numero(t.silobolsa),
              numero(t.total),
            ]}
            empty="Sin existencias."
          />
        </section>
      </TabsContent>

      <TabsContent value="resumen" className="grid gap-6 lg:grid-cols-2">
        <PorCompradorCard filas={planta10} />
        <FijacionVencidaCard filas={planta10} />
      </TabsContent>

      <TabsContent value="contrato" className="space-y-2">
        <p className="text-sm text-ink-soft">
          Una fila por contrato entregado a fijar, ordenada por riesgo: primero lo vencido, después lo
          que vence antes.
        </p>
        <TablaPaginada
          columns={detalleCols}
          rows={porRiesgo(planta10)}
          getRowKey={(r) => `${r.contrato}-${r.cereal}`}
          footer={["TOTAL PLANTA 10", "", "", "", numero(planta10Tn), "", "", ""]}
          empty="Sin contratos a fijar."
          unidad={CONTRATOS}
          page={page}
          onPage={onPage}
        />
      </TabsContent>

      <TabsContent value="exportador" className="space-y-2">
        <p className="text-sm text-ink-soft">
          Con quién hay que gestionar cada fijación: cuando interviene un corredor, la fijación se hace
          con él y no con la exportadora.
        </p>
        <TablaPaginada
          columns={grupoCols}
          rows={grupos}
          getRowKey={(g) => `${g.cereal}-${g.exportador}-${g.via}`}
          footer={["TOTAL", "", "", String(planta10.length), numero(planta10Tn), "", ""]}
          empty="Sin contratos a fijar."
          unidad={GRUPOS}
          page={page}
          onPage={onPage}
        />
      </TabsContent>

      <TabsContent value="revisar" className="space-y-2">
        <p className="text-sm text-ink-soft">
          Contratos con fijado pero sin descarga cargada (intercompany/retiro): falta pasar la carta de
          porte en MacroGest. Es un error de carga, no del cálculo. No lo toca el filtro de vencimiento:
          estas líneas no tienen fijación pendiente.
        </p>
        <TablaPaginada
          columns={alertaCols}
          rows={data.alertasDescarga}
          getRowKey={(r) => r.contrato}
          empty="Ninguna descarga sin pasar."
          unidad={CONTRATOS}
          page={page}
          onPage={onPage}
        />
      </TabsContent>
    </>
  );
}

/** Dos bloques: el encabezado de la solapa (tira de totales o tarjetas) y su tabla. */
function Cargando() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full rounded-card" />
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  );
}
