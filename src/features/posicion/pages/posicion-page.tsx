import { Sliders } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { exportToPdf } from "@/shared/export/export-pdf";
import type { ExportColumn, ExportKpi, ExportSpec } from "@/shared/export/export-types";
import { exportToXlsx } from "@/shared/export/export-xlsx";
import { numero, oDash, pct, usd } from "@/shared/format/format";
import { AjustesDialog } from "../components/ajustes-dialog";
import { PosicionDetalle } from "../components/posicion-detalle";
import { PosicionCard } from "../components/posicion-card";
import { PosicionSkeleton } from "../components/posicion-skeleton";
import { PosicionTable } from "../components/posicion-table";
import { useCampanias } from "../queries/use-campanias";
import { usePosicion, usePosicionDetalle } from "../queries/use-posicion";
import { CEREALES, type PosicionDto } from "../types";

export function PosicionPage() {
  const { hasAnyRole } = useAuth();
  const puedeGestionar = hasAnyRole(["Admin", "Operador"]);

  const campanias = useCampanias();
  const [campaniaSel, setCampaniaSel] = useState<string>();
  const [cereal, setCereal] = useState("");
  const [precioMin, setPrecioMin] = useState(50);
  const [precioMax, setPrecioMax] = useState(700);
  const [ajustesOpen, setAjustesOpen] = useState(false);
  const [tab, setTab] = useState<"resumen" | "detalle">("resumen");

  // Campaña por defecto: el año en curso define la campaña (año-1)-(año). Ej.: 2026 → "2025-2026".
  // Si esa campaña no está en la lista, cae a la más reciente (derivado, sin efecto).
  const anioActual = new Date().getFullYear();
  const campaniaActual = `${anioActual - 1}-${anioActual}`;
  const campania =
    campaniaSel ?? (campanias.data?.includes(campaniaActual) ? campaniaActual : campanias.data?.[0]);

  const posicion = usePosicion(campania, cereal || undefined, precioMin, precioMax);
  const detalle = usePosicionDetalle(cereal || undefined, precioMin, precioMax, tab === "detalle");

  const exportColumns: ExportColumn<PosicionDto>[] = [
    { header: "Cereal", get: (r) => r.cereal },
    { header: "Compra tn", get: (r) => r.tnCompra, format: "number", total: true },
    { header: "P. compra", get: (r) => r.precioCompra, format: "usd" },
    { header: "Venta tn", get: (r) => r.tnVenta, format: "number", total: true },
    { header: "P. venta", get: (r) => r.precioVenta, format: "usd" },
    { header: "Calzadas", get: (r) => r.tnCalzadas, format: "number", total: true },
    { header: "Margen US$/tn", get: (r) => r.margenUsdTn, format: "usd" },
    { header: "Margen %", get: (r) => r.margenPct, format: "percent" },
    { header: "Resultado US$", get: (r) => r.resultadoUsd, format: "usd", total: true },
    { header: "Posición tn", get: (r) => r.posicionFinal, format: "number", total: true },
  ];

  // KPIs por cereal (espejan las tarjetas de la pantalla) para el resumen del export.
  const exportKpis = (filas: PosicionDto[]): ExportKpi[] =>
    filas.map((f) => ({
      titulo: f.cereal,
      acento: f.posicionFinal >= 0 ? "verde" : "rojo",
      metricas: [
        { label: "Margen US$/tn", valor: oDash(f.margenUsdTn, usd), destacado: true },
        { label: "Margen %", valor: oDash(f.margenPct, pct) },
        { label: "Compra", valor: `${numero(f.tnCompra)} tn` },
        { label: "Venta", valor: `${numero(f.tnVenta)} tn` },
        { label: "Resultado", valor: usd(f.resultadoUsd) },
        { label: "Posición", valor: `${numero(f.posicionFinal)} tn` },
      ],
    }));

  const exportSpec = (): ExportSpec<PosicionDto> => ({
    filename: `posicion-${campania ?? "campania"}`,
    title: "Posición de Cereal",
    subtitle: `Campaña ${campania ?? "—"} · ${new Date().toLocaleDateString("es-AR")}`,
    columns: exportColumns,
    rows: posicion.data ?? [],
    kpis: exportKpis(posicion.data ?? []),
  });

  const exportarExcel = () => {
    void exportToXlsx(exportSpec()).catch(() => toast.error("No se pudo generar el Excel."));
  };
  const exportarPdf = () => {
    void exportToPdf(exportSpec()).catch(() => toast.error("No se pudo generar el PDF."));
  };

  return (
    <>
      <PageHeader
        title="Posición de Cereal"
        subtitle="Compras − ventas + ajustes, por campaña y cereal."
        actions={
          <>
            <ExportButtons onExcel={exportarExcel} onPdf={exportarPdf} />
            {puedeGestionar && campania && (
              <Button type="button" size="sm" onClick={() => setAjustesOpen(true)}>
                <Sliders className="size-4" /> Ajustes
              </Button>
            )}
          </>
        }
      />

      <FilterBar>
        <FilterField label="Campaña">
          <Select
            value={campania ?? ""}
            onChange={(e) => setCampaniaSel(e.target.value)}
            disabled={tab === "detalle" || !campanias.data}
          >
            {campanias.data?.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Cereal">
          <Select value={cereal} onChange={(e) => setCereal(e.target.value)}>
            <option value="">Todos</option>
            {CEREALES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Precio mín (US$/tn)">
          <Input
            type="number"
            min={0}
            defaultValue={precioMin}
            className="w-28"
            onBlur={(e) => setPrecioMin(Number(e.target.value) || 0)}
          />
        </FilterField>
        <FilterField label="Precio máx (US$/tn)">
          <Input
            type="number"
            min={0}
            defaultValue={precioMax}
            className="w-28"
            onBlur={(e) => setPrecioMax(Number(e.target.value) || 0)}
          />
        </FilterField>
      </FilterBar>

      {campanias.isError ? (
        <ErrorState error={campanias.error} onRetry={() => void campanias.refetch()} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as "resumen" | "detalle")} className="space-y-4">
          <TabsList>
            <TabsTrigger value="resumen">Resumen actual</TabsTrigger>
            <TabsTrigger value="detalle">Detalle campañas</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen">
            {posicion.isError ? (
              <ErrorState error={posicion.error} onRetry={() => void posicion.refetch()} />
            ) : posicion.isPending || !campania ? (
              <PosicionSkeleton />
            ) : posicion.data.length === 0 ? (
              <EmptyState mensaje="No hay posición para esta campaña / cereal." />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
                  {posicion.data.map((f) => (
                    <PosicionCard key={`${f.campania}-${f.cereal}`} fila={f} />
                  ))}
                </div>
                <PosicionTable filas={posicion.data} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="detalle">
            {detalle.isError ? (
              <ErrorState error={detalle.error} onRetry={() => void detalle.refetch()} />
            ) : detalle.isPending ? (
              <PosicionSkeleton />
            ) : detalle.data?.length === 0 ? (
              <EmptyState mensaje="No hay posición para estos filtros." />
            ) : detalle.data ? (
              <PosicionDetalle filas={detalle.data} />
            ) : null}
          </TabsContent>
        </Tabs>
      )}

      {campania && (
        <AjustesDialog open={ajustesOpen} onClose={() => setAjustesOpen(false)} campania={campania} />
      )}
    </>
  );
}
