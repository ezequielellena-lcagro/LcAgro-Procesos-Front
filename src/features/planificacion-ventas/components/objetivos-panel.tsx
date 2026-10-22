import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { exportToPdf } from "@/shared/export/export-pdf";
import type { ExportSpec } from "@/shared/export/export-types";
import { exportToXlsx } from "@/shared/export/export-xlsx";
import { confirmarCambioConBorrador } from "@/shared/hooks/use-aviso-cambios-sin-guardar";
import type { ContextoPlanificacion } from "../types";
import { useActualizarDatosPlan } from "../queries/use-guardar-plan";
import { useBaseObjetivos } from "../queries/use-base-objetivos";
import {
  armarLineasObjetivos,
  campaniaAnterior,
  columnasObjetivos,
  NOTAS_OBJETIVO_CALCULO,
  NOTAS_OBJETIVOS,
  type LineaObjetivos,
  type VistaObjetivos,
} from "../lib/objetivos";
import { FuenteDatos } from "./fuente-datos";
import { ObjetivosTabla } from "./objetivos-tabla";
import { PorcentajesObjetivos } from "./porcentajes-objetivos";

/**
 * Objetivos por vendedor. Abre en la campaña anterior a la vigente, que es la base de los objetivos
 * de la vigente: arriba gestión carga los porcentajes y abajo la tabla muestra lo real o el
 * objetivo que sale de aplicarlos. Sólo para gestión.
 *
 * La página lo deja montado (oculto) una vez abierto, para que cambiar de solapa no pierda los
 * porcentajes sin guardar; `activo` evita consultar MacroGest mientras no está a la vista.
 */
export function ObjetivosPanel({
  contexto,
  activo = true,
  slotFuente,
  onDirtyChange,
}: {
  contexto: ContextoPlanificacion;
  activo?: boolean;
  slotFuente?: HTMLElement | null;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const campanias = contexto.campanias.map((item) => item.codigo);
  const sugerida = campaniaAnterior(contexto.campaniaVigente);
  const [campaniaElegida, setCampaniaElegida] = useState<string>();
  const [vista, setVista] = useState<VistaObjetivos>("real");
  const [dirty, setDirty] = useState(false);
  const campania = campaniaElegida ?? (campanias.includes(sugerida) ? sugerida : contexto.campaniaVigente);
  const consulta = useBaseObjetivos(campania, activo);
  const actualizar = useActualizarDatosPlan();
  const dataVigente = consulta.data?.campania === campania && !consulta.isPlaceholderData
    ? consulta.data : undefined;
  const lineas = useMemo(() => (dataVigente ? armarLineasObjetivos(dataVigente) : []), [dataVigente]);

  function cambiarDirty(valor: boolean) {
    setDirty(valor);
    onDirtyChange?.(valor);
  }

  function cambiarCampania(nueva: string) {
    if (nueva === campania || !confirmarCambioConBorrador(dirty)) return;
    setCampaniaElegida(nueva);
  }

  function exportar(
    exportador: (spec: ExportSpec<LineaObjetivos>) => Promise<void>,
    nombre: string,
    conNotas: boolean,
  ) {
    if (!dataVigente) return;
    const esObjetivo = vista === "objetivo";
    const spec: ExportSpec<LineaObjetivos> = {
      filename: esObjetivo
        ? `objetivos-${dataVigente.campaniaObjetivo}`
        : `base-objetivos-${dataVigente.campania}`,
      title: esObjetivo ? "Objetivos por vendedor" : "Base de objetivos por vendedor",
      subtitle: esObjetivo
        ? `Objetivos ${dataVigente.campaniaObjetivo} · sobre lo real ${dataVigente.campania}`
        : `Real ${dataVigente.campania} · objetivos ${dataVigente.campaniaObjetivo}`,
      columns: columnasObjetivos(vista),
      rows: lineas,
      notas: conNotas ? [...NOTAS_OBJETIVOS, ...(esObjetivo ? NOTAS_OBJETIVO_CALCULO : [])] : undefined,
    };
    void exportador(spec).catch(() => toast.error(`No se pudo generar el ${nombre}.`));
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterField label="Campaña base">
          <CampaniaSelect value={campania} campanias={campanias} onChange={cambiarCampania} />
        </FilterField>
        <div className="flex items-center gap-2">
          <ExportButtons
            onExcel={() => exportar(exportToXlsx, "Excel", false)}
            onPdf={() => exportar(exportToPdf, "PDF", true)}
            excelDisabled={!dataVigente}
            pdfDisabled={!dataVigente}
          />
        </div>
      </FilterBar>

      {consulta.isError && !dataVigente ? (
        <ErrorState error={consulta.error} onRetry={() => void consulta.refetch()} />
      ) : !dataVigente ? (
        <EmptyState mensaje={`Cargando la base ${campania}…`} />
      ) : (
        <>
          {consulta.isError && <ErrorState error={consulta.error} onRetry={() => void consulta.refetch()} />}
          <PorcentajesObjetivos
            key={dataVigente.campaniaObjetivo}
            data={dataVigente}
            onRecargar={() => void consulta.refetch()}
            onDirtyChange={cambiarDirty}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              {vista === "objetivo"
                ? `Objetivos ${dataVigente.campaniaObjetivo}: lo real ${dataVigente.campania} con los porcentajes de arriba.`
                : `Lo real de ${dataVigente.campania}, base para los objetivos ${dataVigente.campaniaObjetivo}.`}
            </p>
            <div className="flex items-center gap-2" role="group" aria-label="Qué mostrar en la tabla">
              <Button
                type="button"
                size="sm"
                variant={vista === "real" ? "default" : "outline"}
                aria-pressed={vista === "real"}
                onClick={() => setVista("real")}
              >
                Real {dataVigente.campania}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={vista === "objetivo" ? "default" : "outline"}
                aria-pressed={vista === "objetivo"}
                onClick={() => setVista("objetivo")}
              >
                Objetivo {dataVigente.campaniaObjetivo}
              </Button>
            </div>
          </div>
          <ObjetivosTabla lineas={lineas} vista={vista} />
          {vista === "real" && dataVigente.total.marketShare === null && (
            <p className="text-xs text-ink-soft">
              Sin market share: falta el plan de siembra o los parámetros de Market Share de {dataVigente.campania}.
            </p>
          )}
          {vista === "objetivo" && dataVigente.porcentajes.length === 0 && (
            <p className="text-xs text-ink-soft">
              Todavía no hay porcentajes cargados para {dataVigente.campaniaObjetivo}: cargalos arriba.
            </p>
          )}
          {/* El encabezado tiene un solo lugar para la fuente: lo ocupa la solapa a la vista. */}
          {activo && (
            <FuenteDatos
              slot={slotFuente}
              datosMacroGestAl={dataVigente.datosMacroGestAl}
              onActualizar={() => void actualizar.mutateAsync(campania)
                .catch(() => toast.error("No se pudieron actualizar los datos de MacroGest."))}
              actualizando={actualizar.isPending}
            />
          )}
        </>
      )}
    </div>
  );
}
