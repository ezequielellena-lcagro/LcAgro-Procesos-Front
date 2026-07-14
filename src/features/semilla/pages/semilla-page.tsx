import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { env } from "@/lib/env";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { Pagination } from "@/shared/components/pagination";
import { numero } from "@/shared/format/format";
import { SemillaSkeleton } from "../components/semilla-skeleton";
import { SemillaTable } from "../components/semilla-table";
import { useArticulosMapeo } from "../queries/use-articulos-mapeo";
import { useExportarMapeos } from "../queries/use-exportar-mapeos";
import { useExportarSemilla } from "../queries/use-exportar-semilla";
import { useImportarMapeos } from "../queries/use-importar-mapeos";
import { useVentasSemilla } from "../queries/use-ventas-semilla";
import { CULTIVOS, type CultivoSemilla } from "../types";

const PAGE_SIZE = 20;

/** Fecha local de hoy en formato YYYY-MM-DD (valor por defecto del selector). */
function hoyISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Stat({ label, value, acento }: { label: string; value: string; acento?: "verde" | "clementina" }) {
  const color = acento === "verde" ? "text-verde" : acento === "clementina" ? "text-clementina-deep" : "text-ink";
  return (
    <div className="rounded-card border border-line bg-panel p-3.5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export function SemillaPage() {
  const { hasAnyRole } = useAuth();
  const puedeGestionar = hasAnyRole(["semilla"]);

  const [fecha, setFecha] = useState(hoyISO); // YYYY-MM-DD: filtra la grilla por ese DÍA
  const [cultivo, setCultivo] = useState<CultivoSemilla>("Trigo");
  const [page, setPage] = useState(1);
  const [soloSinMapear, setSoloSinMapear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // La declaración/Excel de Sembra es MENSUAL: se trae el mes de la fecha elegida y la grilla filtra al día.
  const [anio, mes] = useMemo(() => {
    const [a, m] = (fecha || hoyISO()).split("-");
    return [Number(a), Number(m)] as const;
  }, [fecha]);
  const filtros = { anio, mes, cultivo };
  const ventas = useVentasSemilla(filtros);
  const exportar = useExportarSemilla();
  const exportarMapeos = useExportarMapeos();
  const importar = useImportarMapeos();
  const articulos = useArticulosMapeo();

  const ventasMes = useMemo(() => ventas.data ?? [], [ventas.data]);
  const hayDatosMes = ventasMes.length > 0; // el Excel (mensual) se habilita si el mes tiene ventas
  // Grilla y KPIs: ventas del mes HASTA la fecha elegida (inclusive). Filtro de cliente sobre el mes traído.
  const filas = useMemo(
    () => (fecha ? ventasMes.filter((v) => v.fechaComprobante.slice(0, 10) <= fecha) : ventasMes),
    [ventasMes, fecha],
  );
  const pendientes = filas.filter((v) => v.requiereMapeo).length;
  const kilosTotales = filas.reduce((acc, v) => acc + v.kilosTotales, 0);
  const hayDatos = filas.length > 0;

  // Sugerencias del matcher (por artículo) para pre-llenar el editor inline y mostrar el valor sugerido.
  const sugerencias = useMemo(
    () => new Map((articulos.data ?? []).map((a) => [a.codigoArticulo, a] as const)),
    [articulos.data],
  );
  // Cuántos renglones tiene cada artículo en el período (para avisar el alcance del guardado).
  const conteoArticulo = useMemo(() => {
    const map = new Map<number, number>();
    for (const f of filas) map.set(f.codigoArticulo, (map.get(f.codigoArticulo) ?? 0) + 1);
    return map;
  }, [filas]);

  // "Solo sin mapear" es un filtro de VISTA extra sobre el día; no afecta el Excel (mensual).
  const filasVista = soloSinMapear ? filas.filter((v) => v.requiereMapeo) : filas;

  // Paginación de la grilla (las tarjetas/KPIs se calculan sobre el día, no sobre la página).
  const total = filasVista.length;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const pageSafe = Math.min(page, totalPages); // al cambiar de filtro/mes la página puede quedar fuera de rango
  const visibles = filasVista.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const exportarExcel = () => exportar.mutate(filtros);
  const onArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-seleccionar el mismo archivo
    if (file) importar.mutate(file);
  };

  return (
    <>
      <PageHeader
        title="Semilla Fiscalizada"
        subtitle="Ventas de semilla (trigo/soja) normalizadas al formato de Sembra Evolución."
        actions={
          <div className="no-print flex items-center gap-2">
            {puedeGestionar && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => exportarMapeos.mutate()}
                  disabled={exportarMapeos.isPending}
                >
                  <Download className="size-4" /> {exportarMapeos.isPending ? "Generando…" : "Variedad Semillas"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={onArchivo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={importar.isPending}
                >
                  <Upload className="size-4" /> {importar.isPending ? "Importando…" : "Importar"}
                </Button>
                <span className="mx-1 h-5 w-px bg-line" aria-hidden />
              </>
            )}
            <ExportButtons onExcel={exportarExcel} excelLoading={exportar.isPending} excelDisabled={!hayDatosMes} />
          </div>
        }
      />

      {env.useMocks && (
        <p className="no-print mb-3 inline-block rounded-md border border-line bg-panel-soft px-3 py-1 text-xs font-medium text-clementina-deep">
          Datos de ejemplo (ficticios).
        </p>
      )}

      <FilterBar>
        <FilterField label="Cultivo">
          <Select
            value={cultivo}
            onChange={(e) => {
              setCultivo(e.target.value as CultivoSemilla);
              setPage(1);
            }}
          >
            {CULTIVOS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Hasta">
          <DateField
            value={fecha}
            onChange={(v) => {
              setFecha(v);
              setPage(1);
            }}
          />
        </FilterField>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-clementina-deep"
            checked={soloSinMapear}
            onChange={(e) => {
              setSoloSinMapear(e.target.checked);
              setPage(1);
            }}
          />
          Solo sin mapear
        </label>
      </FilterBar>

      {ventas.isError ? (
        <ErrorState error={ventas.error} onRetry={() => void ventas.refetch()} />
      ) : ventas.isPending ? (
        <SemillaSkeleton />
      ) : !hayDatos ? (
        <EmptyState mensaje="No hay ventas de semilla fiscalizada hasta esa fecha, para ese cultivo." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            <Stat label="Renglones" value={numero(filas.length)} />
            <Stat label="Kilos totales" value={`${numero(kilosTotales)} kg`} acento="verde" />
            <Stat
              label="Sin mapear"
              value={numero(pendientes)}
              acento={pendientes > 0 ? "clementina" : "verde"}
            />
          </div>

          {pendientes > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-card border border-clementina/40 bg-clementina/10 px-4 py-3">
              <AlertTriangle className="size-5 shrink-0 text-clementina-deep" />
              <p className="flex-1 text-sm text-ink">
                Hay <strong>{pendientes}</strong> renglón(es) sin mapear. Mapealos directo en la grilla (botón{" "}
                <em>Mapear</em>) o en lote con la plantilla <em>Variedad Semillas</em>.
              </p>
              {!soloSinMapear && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSoloSinMapear(true);
                    setPage(1);
                  }}
                >
                  Ver solo sin mapear
                </Button>
              )}
            </div>
          )}

          {filasVista.length === 0 ? (
            <EmptyState mensaje="No quedan renglones sin mapear hasta esa fecha, para ese cultivo." />
          ) : (
            <>
              <SemillaTable
                filas={visibles}
                cultivo={cultivo}
                puedeEditar={puedeGestionar}
                sugerencias={sugerencias}
                conteoArticulo={conteoArticulo}
              />
              {total > PAGE_SIZE && (
                <Pagination page={pageSafe} totalPages={totalPages} total={total} onPage={setPage} />
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
