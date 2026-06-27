import { useState } from "react";
import { env } from "@/lib/env";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/shared/components/page-header";
import { Pagination } from "@/shared/components/pagination";
import { MultiSelect } from "../components/multi-select";
import { StockKpis } from "../components/stock-kpis";
import { StockPorRubro } from "../components/stock-por-rubro";
import { StockSkeleton } from "../components/stock-skeleton";
import { StockTable } from "../components/stock-table";
import { useStock } from "../queries/use-stock";
import { useStockExport } from "../queries/use-stock-export";
import { useStockFiltros } from "../queries/use-stock-filtros";
import type { TipoDeposito } from "../types";

const PAGE_SIZE = 50;

export function StockInsumosPage() {
  const [q, setQ] = useState("");
  const [deposito, setDeposito] = useState<number[]>([]);
  const [rubro, setRubro] = useState<number[]>([]);
  const [tipo, setTipo] = useState<TipoDeposito | "">("");
  const [ventanaDias, setVentanaDias] = useState("90"); // default del backend
  const [page, setPage] = useState(1);

  const filtrosOpts = useStockFiltros();
  const ventana = ventanaDias ? Number(ventanaDias) : undefined;

  const stock = useStock({
    q: q || undefined,
    deposito,
    rubro,
    tipo: tipo || undefined,
    ventanaDias: ventana,
    page,
    pageSize: PAGE_SIZE,
  });
  const exportar = useStockExport();

  const exportarExcel = () =>
    exportar.mutate({ q: q || undefined, deposito, rubro, tipo: tipo || undefined, ventanaDias: ventana });

  const depositoOpts =
    filtrosOpts.data?.depositos.map((d) => ({ value: d.codigo, label: `${d.nombre} (${d.codigo})` })) ?? [];
  const rubroOpts =
    filtrosOpts.data?.rubros.map((r) => ({ value: r.rubro, label: r.rubroDesc })) ?? [];

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

      <FilterBar>
        <FilterField label="Buscar producto / código">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Nombre o código"
          />
        </FilterField>
        <FilterField label="Depósito">
          <MultiSelect
            options={depositoOpts}
            value={deposito}
            onChange={(v) => {
              setDeposito(v);
              setPage(1);
            }}
            placeholder="Todos los depósitos"
            disabled={filtrosOpts.isPending}
          />
        </FilterField>
        <FilterField label="Rubro">
          <MultiSelect
            options={rubroOpts}
            value={rubro}
            onChange={(v) => {
              setRubro(v);
              setPage(1);
            }}
            placeholder="Todos los rubros"
            disabled={filtrosOpts.isPending}
          />
        </FilterField>
        <FilterField label="Tipo">
          <Select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoDeposito | "");
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="Propio">Propio</option>
            <option value="Consignado">Consignado</option>
          </Select>
        </FilterField>
        <FilterField label="Ventana de venta (días)">
          <Input
            type="number"
            inputMode="numeric"
            className="w-28"
            value={ventanaDias}
            onChange={(e) => {
              setVentanaDias(e.target.value);
              setPage(1);
            }}
            placeholder="90"
          />
        </FilterField>
      </FilterBar>

      {stock.isError ? (
        <ErrorState error={stock.error} onRetry={() => void stock.refetch()} />
      ) : stock.isPending ? (
        <StockSkeleton />
      ) : (
        <>
          <StockKpis totales={stock.data.totales} />
          <StockPorRubro porRubro={stock.data.porRubro} />
          {stock.data.items.length === 0 ? (
            <EmptyState mensaje="No hay artículos con esos filtros." />
          ) : (
            <div className="space-y-4">
              <StockTable filas={stock.data.items} />
              <Pagination
                page={stock.data.page}
                totalPages={stock.data.totalPages}
                total={stock.data.total}
                onPage={setPage}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
