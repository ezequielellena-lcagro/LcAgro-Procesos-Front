import { useRef, useState, type ChangeEvent } from "react";
import { Link, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { env } from "@/lib/env";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { Pagination } from "@/shared/components/pagination";
import { exportToPdf } from "@/shared/export/export-pdf";
import type { ExportColumn, ExportSpec } from "@/shared/export/export-types";
import { CuentasKpis } from "../components/cuentas-kpis";
import { CuentasSkeleton } from "../components/cuentas-skeleton";
import { CuentasSubtotales } from "../components/cuentas-subtotales";
import { CuentasTable } from "../components/cuentas-table";
import { EnviarLinkDialog } from "../components/enviar-link-dialog";
import { ObservacionDialog } from "../components/observacion-dialog";
import { useCuentas } from "../queries/use-cuentas";
import { useExportarCuentas } from "../queries/use-exportar-cuentas";
import { useImportarCuentas } from "../queries/use-importar-cuentas";
import { useVendedores } from "../queries/use-enviar-link";
import type { CuentaDto } from "../types";

const PAGE_SIZE = 20;

export function CuentasPage() {
  const { hasAnyRole } = useAuth();
  const puedeEditar = hasAnyRole(["cuentas"]);

  const [q, setQ] = useState("");
  const [vendNro, setVendNro] = useState<number | "">("");
  const [minUsd, setMinUsd] = useState("50"); // umbral por defecto del proceso
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"lista" | "vendedores">("lista");
  const [editar, setEditar] = useState<CuentaDto | null>(null);
  const [enviarLinkOpen, setEnviarLinkOpen] = useState(false);

  const cuentas = useCuentas({
    q: q || undefined,
    vendNro: vendNro === "" ? undefined : vendNro,
    minUsd: minUsd ? Number(minUsd) : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const exportar = useExportarCuentas();
  const importar = useImportarCuentas();
  const vendedores = useVendedores(true); // lista de MacroGest para el filtro y el diálogo de envío
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-seleccionar el mismo archivo
    if (file) importar.mutate(file);
  };

  const exportColumns: ExportColumn<CuentaDto>[] = [
    { header: "Vendedor", get: (r) => r.vendedor },
    { header: "Cuenta", get: (r) => r.cuenta },
    { header: "Cliente", get: (r) => r.denominacion },
    { header: "Vencido USD", get: (r) => r.saldoVencido, format: "usd", total: true },
    { header: "A vencer USD", get: (r) => r.saldoAVencer, format: "usd", total: true },
    { header: "Saldo USD", get: (r) => r.saldo, format: "usd", total: true },
    { header: "Devolución", get: (r) => r.devolucion ?? "" },
    { header: "Observaciones", get: (r) => r.observaciones ?? "" },
  ];

  const exportSpec = (): ExportSpec<CuentaDto> => ({
    filename: "cuentas-usd",
    title: "Cuentas Corrientes USD",
    subtitle: `Saldos USD · ${new Date().toLocaleDateString("es-AR")}`,
    columns: exportColumns,
    rows: cuentas.data?.items ?? [],
  });

  const exportarExcel = () => {
    exportar.mutate({
      q: q || undefined,
      vendNro: vendNro === "" ? undefined : vendNro,
      minUsd: minUsd ? Number(minUsd) : undefined,
    });
  };
  const exportarPdf = () => {
    void exportToPdf(exportSpec()).catch(() => toast.error("No se pudo generar el PDF."));
  };

  return (
    <>
      <PageHeader
        title="Cuentas Corrientes USD"
        subtitle="Saldos vencidos y a vencer en USD (modelo open-item)."
        actions={
          <div className="no-print flex items-center gap-2">
            {puedeEditar && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={onArchivo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={importar.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4" /> {importar.isPending ? "Importando…" : "Importar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEnviarLinkOpen(true)}
                >
                  <Link className="size-4" /> Enviar link
                </Button>
              </>
            )}
            <ExportButtons onExcel={exportarExcel} onPdf={exportarPdf} excelLoading={exportar.isPending} />
          </div>
        }
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
          <Select
            value={vendNro}
            onChange={(e) => {
              setVendNro(e.target.value === "" ? "" : Number(e.target.value));
              setPage(1);
            }}
            disabled={vendedores.isPending}
          >
            <option value="">Todos los vendedores</option>
            {vendedores.data?.map((v) => (
              <option key={v.vendNro} value={v.vendNro}>
                {v.vendedor}
              </option>
            ))}
          </Select>
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
        <div className="space-y-4">
          <CuentasKpis totales={cuentas.data.totales} />
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="lista">Lista completa</TabsTrigger>
              <TabsTrigger value="vendedores">Total por vendedor</TabsTrigger>
            </TabsList>

            <TabsContent value="lista">
              {cuentas.data.items.length === 0 ? (
                <EmptyState mensaje="No hay cuentas con esos filtros." />
              ) : (
                <div className="space-y-4">
                  <CuentasTable filas={cuentas.data.items} puedeEditar={puedeEditar} onEditar={setEditar} />
                  <Pagination
                    page={cuentas.data.page}
                    totalPages={cuentas.data.totalPages}
                    total={cuentas.data.total}
                    onPage={setPage}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="vendedores">
              {cuentas.data.subtotales.length === 0 ? (
                <EmptyState mensaje="No hay cuentas con esos filtros." />
              ) : (
                <CuentasSubtotales subtotales={cuentas.data.subtotales} totales={cuentas.data.totales} />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      <ObservacionDialog cuenta={editar} onClose={() => setEditar(null)} />
      <EnviarLinkDialog open={enviarLinkOpen} onClose={() => setEnviarLinkOpen(false)} />
    </>
  );
}
