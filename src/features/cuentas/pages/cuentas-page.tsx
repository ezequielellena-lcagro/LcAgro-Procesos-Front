import { useState } from "react";
import { History, Link } from "lucide-react";
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
import { fecha, hoyIso } from "@/shared/format/format";
import type { ExportColumn, ExportSpec } from "@/shared/export/export-types";
import { CuentasKpis } from "../components/cuentas-kpis";
import { CuentasSkeleton } from "../components/cuentas-skeleton";
import { CuentasSubtotales } from "../components/cuentas-subtotales";
import { CuentasTable } from "../components/cuentas-table";
import { ContadoPanel } from "../components/contado-panel";
import { HistoricoPanel } from "../components/historico-panel";
import { EnviarLinkDialog } from "../components/enviar-link-dialog";
import { ImportarCuentasButton } from "../components/importar-cuentas-button";
import { ObservacionDialog } from "../components/observacion-dialog";
import { useCuentas } from "../queries/use-cuentas";
import { useExportarCuentas } from "../queries/use-exportar-cuentas";
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
  const [tab, setTab] = useState<"lista" | "vendedores" | "contado" | "historico">("lista");
  const [editar, setEditar] = useState<CuentaDto | null>(null);
  const [enviarLinkOpen, setEnviarLinkOpen] = useState(false);
  // La pantalla arranca SIEMPRE en hoy (los saldos en vivo son el uso normal). Mover esta fecha para
  // atrás reconstruye el listado tal como estaba ese día, para volver a sacar un informe ya presentado.
  const [corte, setCorte] = useState(hoyIso());

  const hoy = hoyIso();
  const esRetroactivo = corte !== "" && corte < hoy;
  // Con el corte en hoy no se manda el parámetro: la consulta queda idéntica a la de siempre.
  const corteParam = esRetroactivo ? corte : undefined;

  const cuentas = useCuentas({
    q: q || undefined,
    vendNro: vendNro === "" ? undefined : vendNro,
    minUsd: minUsd ? Number(minUsd) : undefined,
    page,
    pageSize: PAGE_SIZE,
    corte: corteParam,
  });

  const exportar = useExportarCuentas();
  const vendedores = useVendedores(true); // lista de MacroGest para el filtro y el diálogo de envío

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
    title: "Cuentas Corrientes Clientes USD",
    // El subtítulo lleva el corte de los datos, no el día de la impresión: es lo que hace que el
    // informe se pueda contrastar después.
    subtitle: `Saldos USD al ${fecha(cuentas.data?.corte ?? hoy)}`,
    columns: exportColumns,
    rows: cuentas.data?.items ?? [],
  });

  const exportarExcel = () => {
    exportar.mutate({
      q: q || undefined,
      vendNro: vendNro === "" ? undefined : vendNro,
      minUsd: minUsd ? Number(minUsd) : undefined,
      corte: corteParam,
    });
  };
  const exportarPdf = () => {
    void exportToPdf(exportSpec()).catch(() => toast.error("No se pudo generar el PDF."));
  };

  return (
    <>
      <PageHeader
        title="Cuentas Corrientes Clientes USD"
        subtitle="Saldos vencidos y a vencer en USD (modelo open-item)."
        actions={
          <div className="no-print flex items-center gap-2">
            {puedeEditar && (
              <>
                <ImportarCuentasButton />
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

      {/* Orden de la pantalla: primero QUÉ se mira (pestañas), después CON QUÉ filtros, y recién ahí
          los números y la tabla. Los filtros viven fuera de los paneles: son los mismos en las tres
          solapas en vivo, así no se redibujan al cambiar de pestaña. */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="lista">Lista completa</TabsTrigger>
          <TabsTrigger value="vendedores">Total por vendedor</TabsTrigger>
          <TabsTrigger value="contado">Contado</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* El histórico no usa nada de esto: elige un mes ya cerrado y trae su propia foto, con
            sus propios totales. Filtrar el listado en vivo no lo toca. */}
        {tab !== "historico" && (
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
            <FilterField label="Saldos al">
              <Input
                type="date"
                className="w-44"
                value={corte}
                max={hoy}
                onChange={(e) => {
                  setCorte(e.target.value || hoy);
                  setPage(1);
                }}
              />
            </FilterField>
          </FilterBar>
        )}

        {tab !== "historico" && esRetroactivo && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-clementina/40 bg-clementina/10 px-3 py-2 text-sm text-clementina-deep">
            <History className="size-4 shrink-0" aria-hidden="true" />
            <span>
              Estás viendo los saldos al <span className="font-semibold">{fecha(corte)}</span>, no los
              de hoy. Devolución y Observaciones son siempre la carga en curso.
            </span>
            <button
              type="button"
              className="no-print font-semibold underline underline-offset-2"
              onClick={() => {
                setCorte(hoy);
                setPage(1);
              }}
            >
              Volver a hoy
            </button>
          </div>
        )}

        {tab === "historico" ? (
          <TabsContent value="historico">
            <HistoricoPanel puedeGestionar={puedeEditar} />
          </TabsContent>
        ) : cuentas.isError ? (
          <ErrorState error={cuentas.error} onRetry={() => void cuentas.refetch()} />
        ) : cuentas.isPending ? (
          <CuentasSkeleton kpis={tab === "lista"} />
        ) : (
          <>
            {/* Resumen del listado completo. En las otras solapas los números que importan los
                pone cada panel, así que no se repiten acá. */}
            {tab === "lista" && <CuentasKpis totales={cuentas.data.totales} />}

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

            <TabsContent value="contado">
              <ContadoPanel
                vendNro={vendNro === "" ? undefined : vendNro}
                minUsd={minUsd ? Number(minUsd) : undefined}
                corte={corteParam}
                activa={tab === "contado"}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <ObservacionDialog cuenta={editar} onClose={() => setEditar(null)} />
      <EnviarLinkDialog open={enviarLinkOpen} onClose={() => setEnviarLinkOpen(false)} />
    </>
  );
}
