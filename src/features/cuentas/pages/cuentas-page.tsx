import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { env } from "@/lib/env";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { Pagination } from "@/shared/components/pagination";
import { exportToPdf } from "@/shared/export/export-pdf";
import { exportToCsv } from "@/shared/export/to-csv";
import { usd } from "@/shared/format/format";
import { CuentasKpis } from "../components/cuentas-kpis";
import { CuentasSkeleton } from "../components/cuentas-skeleton";
import { CuentasTable } from "../components/cuentas-table";
import { ObservacionDialog } from "../components/observacion-dialog";
import { useCuentas } from "../queries/use-cuentas";
import type { CuentaDto } from "../types";

const PAGE_SIZE = 20;

export function CuentasPage() {
  const { hasAnyRole } = useAuth();
  const puedeEditar = hasAnyRole(["Admin", "Cobranzas"]);

  const [q, setQ] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [minUsd, setMinUsd] = useState("");
  const [page, setPage] = useState(1);
  const [editar, setEditar] = useState<CuentaDto | null>(null);

  const cuentas = useCuentas({
    q: q || undefined,
    vendedor: vendedor || undefined,
    minUsd: minUsd ? Number(minUsd) : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const exportarExcel = () =>
    exportToCsv<CuentaDto>(
      "cuentas-usd",
      [
        { header: "Vendedor", value: (r) => r.vendedor },
        { header: "Cuenta", value: (r) => r.cuenta },
        { header: "Cliente", value: (r) => r.denominacion },
        { header: "Vencido USD", value: (r) => usd(r.saldoVencido) },
        { header: "A vencer USD", value: (r) => usd(r.saldoAVencer) },
        { header: "Saldo USD", value: (r) => usd(r.saldo) },
        { header: "Devolución", value: (r) => r.devolucion ?? "" },
        { header: "Observaciones", value: (r) => r.observaciones ?? "" },
      ],
      cuentas.data?.items ?? [],
    );

  return (
    <>
      <PageHeader
        title="Cuentas Corrientes USD"
        subtitle="Saldos vencidos y a vencer en USD (modelo open-item)."
        actions={<ExportButtons onExcel={exportarExcel} onPdf={exportToPdf} />}
      />

      {env.useMocks && (
        <p className="no-print mb-3 inline-block rounded-md border border-line bg-panel-soft px-3 py-1 text-xs font-medium text-clementina-deep">
          Datos de ejemplo (ficticios).
        </p>
      )}

      <FilterBar>
        <FilterField label="Buscar cliente / cuenta">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Denominación o N° de cuenta"
          />
        </FilterField>
        <FilterField label="Vendedor">
          <Input
            value={vendedor}
            onChange={(e) => {
              setVendedor(e.target.value);
              setPage(1);
            }}
            placeholder="Nombre del vendedor"
          />
        </FilterField>
        <FilterField label="Mín. USD">
          <Input
            type="number"
            inputMode="numeric"
            className="w-28"
            value={minUsd}
            onChange={(e) => {
              setMinUsd(e.target.value);
              setPage(1);
            }}
            placeholder="0"
          />
        </FilterField>
      </FilterBar>

      {cuentas.isError ? (
        <ErrorState error={cuentas.error} onRetry={() => void cuentas.refetch()} />
      ) : cuentas.isPending ? (
        <CuentasSkeleton />
      ) : (
        <>
          <CuentasKpis items={cuentas.data.items} total={cuentas.data.total} />
          {cuentas.data.items.length === 0 ? (
            <EmptyState mensaje="No hay cuentas con esos filtros." />
          ) : (
            <>
              <CuentasTable filas={cuentas.data.items} puedeEditar={puedeEditar} onEditar={setEditar} />
              <Pagination
                page={cuentas.data.page}
                totalPages={cuentas.data.totalPages}
                total={cuentas.data.total}
                onPage={setPage}
              />
            </>
          )}
        </>
      )}

      <ObservacionDialog cuenta={editar} onClose={() => setEditar(null)} />
    </>
  );
}
