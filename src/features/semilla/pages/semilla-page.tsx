import { useState } from "react";
import { AlertTriangle, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { env } from "@/lib/env";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { numero } from "@/shared/format/format";
import { MapeosDialog } from "../components/mapeos-dialog";
import { SemillaSkeleton } from "../components/semilla-skeleton";
import { SemillaTable } from "../components/semilla-table";
import { useExportarSemilla } from "../queries/use-exportar-semilla";
import { useVentasSemilla } from "../queries/use-ventas-semilla";
import { CULTIVOS, MESES, type CultivoSemilla } from "../types";

const HOY = new Date();
const ANIOS = Array.from({ length: 4 }, (_, i) => HOY.getFullYear() - i);

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
  const puedeGestionar = hasAnyRole(["Admin", "Operador"]);

  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [cultivo, setCultivo] = useState<CultivoSemilla>("Trigo");
  const [mapeosOpen, setMapeosOpen] = useState(false);

  const filtros = { anio, mes, cultivo };
  const ventas = useVentasSemilla(filtros);
  const exportar = useExportarSemilla();

  const filas = ventas.data ?? [];
  const pendientes = filas.filter((v) => v.requiereMapeo).length;
  const kilosTotales = filas.reduce((acc, v) => acc + v.kilosTotales, 0);
  const hayDatos = filas.length > 0;

  const exportarExcel = () => exportar.mutate(filtros);

  return (
    <>
      <PageHeader
        title="Semilla Fiscalizada"
        subtitle="Ventas del mes (trigo/soja) normalizadas al formato de Sembra Evolución."
        actions={
          <div className="no-print flex items-center gap-2">
            {puedeGestionar && (
              <Button type="button" variant="outline" size="sm" onClick={() => setMapeosOpen(true)}>
                <Sprout className="size-4" /> Mapeo de variedades
              </Button>
            )}
            <ExportButtons
              onExcel={exportarExcel}
              excelLoading={exportar.isPending}
              excelDisabled={!hayDatos || pendientes > 0}
            />
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
          <Select value={cultivo} onChange={(e) => setCultivo(e.target.value as CultivoSemilla)}>
            {CULTIVOS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Mes">
          <Select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Año">
          <Select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {ANIOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {ventas.isError ? (
        <ErrorState error={ventas.error} onRetry={() => void ventas.refetch()} />
      ) : ventas.isPending ? (
        <SemillaSkeleton />
      ) : !hayDatos ? (
        <EmptyState mensaje="No hay ventas de semilla fiscalizada para este mes y cultivo." />
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
                Hay <strong>{pendientes}</strong> renglón(es) de artículos sin mapear. Resolvé el mapeo de
                variedades antes de exportar el Excel.
              </p>
              {puedeGestionar && (
                <Button type="button" size="sm" onClick={() => setMapeosOpen(true)}>
                  Resolver mapeo
                </Button>
              )}
            </div>
          )}

          <SemillaTable filas={filas} />
        </div>
      )}

      <MapeosDialog open={mapeosOpen} onClose={() => setMapeosOpen(false)} />
    </>
  );
}
