import { Sliders } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { exportToPdf } from "@/shared/export/export-pdf";
import { exportToCsv } from "@/shared/export/to-csv";
import { numero, oDash, pct, usd } from "@/shared/format/format";
import { AjustesDialog } from "../components/ajustes-dialog";
import { PosicionCard } from "../components/posicion-card";
import { PosicionSkeleton } from "../components/posicion-skeleton";
import { PosicionTable } from "../components/posicion-table";
import { useCampanias } from "../queries/use-campanias";
import { usePosicion } from "../queries/use-posicion";
import { CEREALES, type PosicionDto } from "../types";

export function PosicionPage() {
  const { hasAnyRole } = useAuth();
  const puedeGestionar = hasAnyRole(["Admin", "Operador"]);

  const campanias = useCampanias();
  const [campaniaSel, setCampaniaSel] = useState<string>();
  const [cereal, setCereal] = useState("");
  const [ajustesOpen, setAjustesOpen] = useState(false);

  // Campaña efectiva: la elegida, o la más reciente de la lista (derivado, sin efecto).
  const campania = campaniaSel ?? campanias.data?.[0];

  const posicion = usePosicion(campania, cereal || undefined);

  const exportarExcel = () =>
    exportToCsv<PosicionDto>(
      `posicion-${campania ?? "campania"}`,
      [
        { header: "Campaña", value: (r) => r.campania },
        { header: "Cereal", value: (r) => r.cereal },
        { header: "Compra tn", value: (r) => numero(r.tnCompra) },
        { header: "P. compra", value: (r) => oDash(r.precioCompra, usd) },
        { header: "Venta tn", value: (r) => numero(r.tnVenta) },
        { header: "P. venta", value: (r) => oDash(r.precioVenta, usd) },
        { header: "Calzadas", value: (r) => numero(r.tnCalzadas) },
        { header: "Margen US$/tn", value: (r) => oDash(r.margenUsdTn, usd) },
        { header: "Margen %", value: (r) => oDash(r.margenPct, pct) },
        { header: "Resultado US$", value: (r) => usd(r.resultadoUsd) },
        { header: "Posición tn", value: (r) => numero(r.posicionFinal) },
      ],
      posicion.data ?? [],
    );

  return (
    <>
      <PageHeader
        title="Posición de Cereal"
        subtitle="Compras − ventas + ajustes, por campaña y cereal."
        actions={
          <>
            <ExportButtons onExcel={exportarExcel} onPdf={exportToPdf} />
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
            disabled={!campanias.data}
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
      </FilterBar>

      {campanias.isError ? (
        <ErrorState error={campanias.error} onRetry={() => void campanias.refetch()} />
      ) : posicion.isError ? (
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

      {campania && (
        <AjustesDialog open={ajustesOpen} onClose={() => setAjustesOpen(false)} campania={campania} />
      )}
    </>
  );
}
