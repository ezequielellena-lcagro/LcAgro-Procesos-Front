import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { KpiCard } from "@/shared/components/kpi-card";
import { exportToPdf } from "@/shared/export/export-pdf";
import type { ExportSpec } from "@/shared/export/export-types";
import { exportToXlsx } from "@/shared/export/export-xlsx";
import { numero, numero3, pct, tn, usd } from "@/shared/format/format";
import type { ContextoPlanificacion } from "../types";
import { useActualizarDatosPlan } from "../queries/use-guardar-plan";
import { useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import { useConsolidado } from "../queries/use-consolidado";
import { armarLineasConsolidado, columnasConsolidado, type LineaConsolidado } from "../lib/consolidado";
import { ConsolidadoTabla } from "./consolidado-tabla";
import { FuenteDatos, LEYENDA_AJUSTE, LEYENDA_CONSOLIDADO, NOTA_D10 } from "./fuente-datos";

export function ConsolidadoPanel({ contexto }: { contexto: ContextoPlanificacion }) {
  const [campaniaElegida, setCampaniaElegida] = useState<string>();
  const campania = campaniaElegida ?? contexto.campaniaVigente;
  const [vendedorId, setVendedorId] = useState<number>();
  const agrupacion = "vendedor";
  const [verSorgoGirasol, setVerSorgoGirasol] = useState(false);
  const gestion = contexto.alcance.veTodo;
  const vendedorPropioId = contexto.alcance.vendedor?.id;
  const puedeConsultar = gestion || vendedorPropioId !== undefined;
  const vendedores = useVendedoresPlanificacion(gestion);
  const consulta = useConsolidado(
    campania,
    gestion ? vendedorId : undefined,
    undefined,
    puedeConsultar,
  );
  const actualizar = useActualizarDatosPlan();
  const dataVigente = consulta.data?.campania === campania && !consulta.isPlaceholderData
    ? consulta.data : undefined;
  const lineas = useMemo(() => dataVigente
    ? armarLineasConsolidado(dataVigente, agrupacion, gestion, { vendedorId, vendedorPropioId })
    : [], [dataVigente, gestion, vendedorId, vendedorPropioId]);
  const total = dataVigente?.totalGeneral;
  const participacionOrigen = total?.potencialTn && total.potencialTn > 0
    ? total.originacionTn.campania / total.potencialTn : null;

  function exportSpec(): ExportSpec<LineaConsolidado> {
    return {
      filename: `consolidado-clientes-${campania}`,
      title: "Ventas consolidado Clientes",
      subtitle: `Campaña ${campania}`,
      columns: columnasConsolidado(verSorgoGirasol),
      rows: lineas,
      notas: [LEYENDA_CONSOLIDADO, LEYENDA_AJUSTE, ...(campania === "2025-2026" ? [NOTA_D10] : [])],
    };
  }
  function exportar(exportador: (spec: ExportSpec<LineaConsolidado>) => Promise<void>, nombre: string) {
    if (!dataVigente) return;
    void exportador(exportSpec()).catch(() => toast.error(`No se pudo generar el ${nombre}.`));
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterField label="Campaña">
          <CampaniaSelect
            value={campania}
            campanias={contexto.campanias.map((item) => item.codigo)}
            onChange={setCampaniaElegida}
          />
        </FilterField>
        {gestion && (
          <>
            <FilterField label="Vendedor">
              <Select value={vendedorId ?? ""} onChange={(evento) => setVendedorId(Number(evento.target.value) || undefined)}>
                <option value="">Todos</option>
                {vendedores.data?.filter((item) => item.activo)
                  .map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </Select>
            </FilterField>
          </>
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" aria-pressed={verSorgoGirasol} onClick={() => setVerSorgoGirasol((actual) => !actual)}>
            {verSorgoGirasol ? "Ocultar sorgo/girasol" : "Ver sorgo/girasol"}
          </Button>
          <ExportButtons
            onExcel={() => exportar(exportToXlsx, "Excel")}
            onPdf={() => exportar(exportToPdf, "PDF")}
            excelDisabled={!dataVigente}
            pdfDisabled={!dataVigente}
          />
        </div>
      </FilterBar>

      {!puedeConsultar ? (
        <EmptyState mensaje="Tu usuario no tiene cartera asignada. Pedíselo al administrador." />
      ) : consulta.isError && !dataVigente ? (
        <ErrorState error={consulta.error} onRetry={() => void consulta.refetch()} />
      ) : !dataVigente ? (
        <EmptyState mensaje={`Cargando consolidado de ${campania}…`} />
      ) : dataVigente.sinVendedor ? (
        <EmptyState mensaje="Tu usuario no tiene cartera asignada. Pedíselo al administrador." />
      ) : (
        <>
          {consulta.isError && <ErrorState error={consulta.error} onRetry={() => void consulta.refetch()} />}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Mercado" value={total?.mercadoUsd == null ? "—" : usd(total.mercadoUsd)} hint="USD estimados" />
            <KpiCard label="Facturación LC" value={usd(total?.facturacionLcUsd ?? 0)} hint="USD · incluye conciliación" />
            <KpiCard label="Participación LC" value={total?.participacionLc == null ? "—" : pct(total.participacionLc * 100)} hint="sobre productores con mercado" />
            <KpiCard label="Hectáreas" value={numero(total?.hectareas.total ?? 0)} />
            <KpiCard label="Potencial" value={total?.potencialTn == null ? "—" : tn(total.potencialTn)} />
            <KpiCard label="Originación" value={`${numero3(total?.originacionTn.campania ?? 0)} tn`} hint="campaña · maíz, soja y trigo" />
            <KpiCard label="Participación en originación" value={participacionOrigen == null ? "—" : pct(participacionOrigen * 100)} hint="originación campaña / potencial" />
          </div>
          {dataVigente.filas.length === 0 && !dataVigente.fueraDeCarteras && (
            <EmptyState mensaje="No hay productores con plan ni movimientos en esta selección." />
          )}
          <ConsolidadoTabla lineas={lineas} verSorgoGirasol={verSorgoGirasol} />
          <FuenteDatos
            campania={campania}
            datosMacroGestAl={dataVigente.datosMacroGestAl}
            onActualizar={() => void actualizar.mutateAsync(campania).catch(() => toast.error("No se pudieron actualizar los datos de MacroGest."))}
            actualizando={actualizar.isPending}
          />
        </>
      )}
    </div>
  );
}
