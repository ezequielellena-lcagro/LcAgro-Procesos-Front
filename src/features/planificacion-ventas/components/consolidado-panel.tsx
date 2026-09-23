import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampaniaSelect } from "@/shared/components/campania-select";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { MultiSelect } from "@/shared/components/multi-select";
import { exportToPdf } from "@/shared/export/export-pdf";
import type { ExportSpec } from "@/shared/export/export-types";
import { exportToXlsx } from "@/shared/export/export-xlsx";
import type { ContextoPlanificacion } from "../types";
import { useActualizarDatosPlan } from "../queries/use-guardar-plan";
import { useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import { useConsolidado } from "../queries/use-consolidado";
import { armarLineasConsolidado, columnasConsolidado, type LineaConsolidado } from "../lib/consolidado";
import { LEYENDA_AJUSTE, LEYENDA_CONSOLIDADO, NOTA_D10 } from "../lib/leyendas";
import { ConsolidadoTabla } from "./consolidado-tabla";
import { FuenteDatos } from "./fuente-datos";

export function ConsolidadoPanel({
  contexto,
  slotFuente,
}: {
  contexto: ContextoPlanificacion;
  slotFuente?: HTMLElement | null;
}) {
  const [campaniaElegida, setCampaniaElegida] = useState<string>();
  const campania = campaniaElegida ?? contexto.campaniaVigente;
  const [vendedorIds, setVendedorIds] = useState<number[]>([]);
  const [buscar, setBuscar] = useState("");
  const texto = buscar.trim();
  const agrupacion = "vendedor";
  const [verSorgoGirasol, setVerSorgoGirasol] = useState(false);
  // Grupos plegados, por clave de grupo. Se conservan al cambiar campaña o selección: la clave es
  // el vendedor, así que lo que el usuario plegó sigue plegado donde vuelva a aparecer.
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const gestion = contexto.alcance.veTodo;
  const vendedorPropioId = contexto.alcance.vendedor?.id;
  const puedeConsultar = gestion || vendedorPropioId !== undefined;
  const vendedores = useVendedoresPlanificacion(gestion);
  const consulta = useConsolidado(campania, gestion ? vendedorIds : [], undefined, puedeConsultar);
  const actualizar = useActualizarDatosPlan();
  const dataVigente = consulta.data?.campania === campania && !consulta.isPlaceholderData
    ? consulta.data : undefined;
  const lineas = useMemo(() => dataVigente
    ? armarLineasConsolidado(dataVigente, agrupacion, gestion, { vendedorIds, vendedorPropioId, texto })
    : [], [dataVigente, gestion, vendedorIds, vendedorPropioId, texto]);
  const productores = useMemo(
    () => lineas.filter((linea) => linea.tipo === "productor").length,
    [lineas],
  );
  const grupos = useMemo(() => lineas.flatMap((linea) =>
    linea.tipo === "grupo" && linea.grupo ? [linea.grupo] : []), [lineas]);
  const todoPlegado = grupos.length > 0 && grupos.every((grupo) => colapsados.has(grupo));
  const alternarGrupo = (grupo: string) => setColapsados((previos) => {
    const proximos = new Set(previos);
    if (!proximos.delete(grupo)) proximos.add(grupo);
    return proximos;
  });

  // Las leyendas van sólo en el PDF, que se imprime o se manda por fuera y tiene que explicarse
  // solo. El Excel se abre para trabajar los números: ahí empujan la tabla hacia abajo sin aportar.
  function exportSpec(conNotas: boolean): ExportSpec<LineaConsolidado> {
    return {
      filename: `consolidado-clientes-${campania}`,
      title: "Ventas consolidado Clientes",
      // El export sale con lo que está a la vista: si hay búsqueda, se aclara en el subtítulo para
      // que nadie lea un archivo filtrado como si fuera la cartera completa.
      subtitle: texto ? `Campaña ${campania} · filtrado por "${texto}"` : `Campaña ${campania}`,
      columns: columnasConsolidado(verSorgoGirasol),
      rows: lineas,
      notas: conNotas
        ? [LEYENDA_CONSOLIDADO, LEYENDA_AJUSTE, ...(campania === "2025-2026" ? [NOTA_D10] : [])]
        : undefined,
    };
  }
  function exportar(
    exportador: (spec: ExportSpec<LineaConsolidado>) => Promise<void>,
    nombre: string,
    conNotas: boolean,
  ) {
    if (!dataVigente) return;
    void exportador(exportSpec(conNotas)).catch(() => toast.error(`No se pudo generar el ${nombre}.`));
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
          <FilterField label="Vendedor">
            <MultiSelect
              ariaLabel="Vendedor"
              options={vendedores.data?.filter((item) => item.activo)
                .map((item) => ({ value: item.id, label: item.nombre })) ?? []}
              value={vendedorIds}
              onChange={setVendedorIds}
              placeholder="Todos"
            />
          </FilterField>
        )}
        <FilterField label="Buscar">
          <Input
            aria-label="Buscar productor"
            value={buscar}
            onChange={(evento) => setBuscar(evento.target.value)}
            placeholder="Nombre o CUIT"
            className="min-w-52"
          />
        </FilterField>
        <div className="flex items-center gap-2">
          {grupos.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={todoPlegado}
              onClick={() => setColapsados(todoPlegado ? new Set() : new Set(grupos))}
            >
              {todoPlegado ? "Desplegar todo" : "Colapsar todo"}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" aria-pressed={verSorgoGirasol} onClick={() => setVerSorgoGirasol((actual) => !actual)}>
            {verSorgoGirasol ? "Ocultar sorgo/girasol" : "Ver sorgo/girasol"}
          </Button>
          <ExportButtons
            onExcel={() => exportar(exportToXlsx, "Excel", false)}
            onPdf={() => exportar(exportToPdf, "PDF", true)}
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
          {dataVigente.filas.length === 0 && !dataVigente.fueraDeCarteras && (
            <EmptyState mensaje="No hay productores con plan ni movimientos en esta selección." />
          )}
          {texto && productores === 0 && dataVigente.filas.length > 0 ? (
            <EmptyState mensaje={`Ningún productor coincide con "${texto}".`} />
          ) : (
            <ConsolidadoTabla
              lineas={lineas}
              verSorgoGirasol={verSorgoGirasol}
              colapsados={colapsados}
              onToggleGrupo={alternarGrupo}
            />
          )}
          <FuenteDatos
            slot={slotFuente}
            datosMacroGestAl={dataVigente.datosMacroGestAl}
            onActualizar={() => void actualizar.mutateAsync(campania).catch(() => toast.error("No se pudieron actualizar los datos de MacroGest."))}
            actualizando={actualizar.isPending}
          />
        </>
      )}
    </div>
  );
}
