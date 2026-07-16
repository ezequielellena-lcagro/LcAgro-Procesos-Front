import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/lib/env";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { PageHeader } from "@/shared/components/page-header";
import { Pagination } from "@/shared/components/pagination";
import { InmovilizadoTable } from "../components/inmovilizado-table";
import { StockFiltrosBar } from "../components/stock-filtros-bar";
import { StockKpis } from "../components/stock-kpis";
import { StockPorRubro } from "../components/stock-por-rubro";
import { StockSkeleton } from "../components/stock-skeleton";
import { StockTable } from "../components/stock-table";
import { VencimientosTable } from "../components/vencimientos-table";
import { useStock } from "../queries/use-stock";
import { useStockExport } from "../queries/use-stock-export";
import { useStockFiltros } from "../queries/use-stock-filtros";
import { FILTROS_INICIALES, filtrosAQuery, type FiltrosCompartidos } from "../filtros";
import { presetDeTab, TABS_STOCK, type TabStock } from "../tabs";
import type { StockListado } from "../types";

const PAGE_SIZE = 50;

function PanelPaginado({
  listado,
  onPage,
  vacio,
  children,
}: {
  listado: StockListado;
  onPage: (p: number) => void;
  vacio: string;
  children: ReactNode;
}) {
  if (listado.items.length === 0) return <EmptyState mensaje={vacio} />;
  return (
    <div className="space-y-4">
      {children}
      <Pagination
        page={listado.page}
        totalPages={listado.totalPages}
        total={listado.total}
        onPage={onPage}
      />
    </div>
  );
}

export function StockInsumosPage() {
  const [filtros, setFiltros] = useState<FiltrosCompartidos>(FILTROS_INICIALES);
  const [tab, setTab] = useState<TabStock>("stock");
  const [page, setPage] = useState(1);

  const filtrosOpts = useStockFiltros();
  const compartidos = filtrosAQuery(filtros);
  const preset = presetDeTab(tab);

  const stock = useStock({ ...compartidos, ...preset, page, pageSize: PAGE_SIZE });
  const exportar = useStockExport();

  // Cambiar de solapa o de filtro invalida la página en la que estabas.
  const cambiarTab = (v: TabStock) => {
    setTab(v);
    setPage(1);
  };
  const cambiarFiltros = (v: FiltrosCompartidos) => {
    setFiltros(v);
    setPage(1);
  };

  // El Excel baja lo que estás mirando: mismos filtros + preset de la solapa activa.
  const exportarExcel = () => exportar.mutate({ ...compartidos, ...preset });

  return (
    <>
      <PageHeader
        title="Stock de Insumos"
        subtitle="Stock valorizado en USD por depósito, rubro y artículo, con cobertura y semáforo de rotación."
        actions={<ExportButtons onExcel={exportarExcel} excelLoading={exportar.isPending} />}
      />

      {env.useMocks && (
        <p className="no-print mb-3 inline-block rounded-md border border-line bg-panel-soft px-3 py-1 text-xs font-medium text-clementina-deep">
          Datos de ejemplo (ficticios).
        </p>
      )}

      <StockFiltrosBar
        valor={filtros}
        onChange={cambiarFiltros}
        opciones={filtrosOpts.data}
        cargando={filtrosOpts.isPending}
      />

      {stock.isError ? (
        <ErrorState error={stock.error} onRetry={() => void stock.refetch()} />
      ) : (
        <Tabs value={tab} onValueChange={cambiarTab} className="space-y-4">
          <TabsList>
            {TABS_STOCK.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {stock.isPending ? (
            <StockSkeleton />
          ) : (
            <>
              {/* `totales` sale del set base: los KPIs no cambian al cambiar de solapa. */}
              <StockKpis tab={tab} totales={stock.data.totales} />

              <TabsContent value="stock">
                <PanelPaginado
                  listado={stock.data}
                  onPage={setPage}
                  vacio="No hay artículos con esos filtros."
                >
                  <StockTable filas={stock.data.items} />
                </PanelPaginado>
              </TabsContent>

              <TabsContent value="vencimientos">
                <PanelPaginado
                  listado={stock.data}
                  onPage={setPage}
                  vacio="No hay lotes vencidos ni próximos a vencer con esos filtros."
                >
                  <VencimientosTable filas={stock.data.items} />
                </PanelPaginado>
              </TabsContent>

              <TabsContent value="inmovilizado">
                <PanelPaginado
                  listado={stock.data}
                  onPage={setPage}
                  vacio="No hay artículos inmovilizados con esos filtros."
                >
                  <InmovilizadoTable filas={stock.data.items} />
                </PanelPaginado>
              </TabsContent>

              <TabsContent value="rubro">
                <StockPorRubro porRubro={stock.data.porRubro} />
              </TabsContent>
            </>
          )}
        </Tabs>
      )}
    </>
  );
}
