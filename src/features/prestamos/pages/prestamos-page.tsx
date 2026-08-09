import { useState } from "react";
import { Download, FileUp, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/lib/env";
import { useAuth } from "@/features/auth/auth-context";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { ConciliacionPanel } from "../components/conciliacion-panel";
import { ImportarDialog } from "../components/importar-dialog";
import { OperacionesTable } from "../components/operaciones-table";
import { PagarCuotaDialog } from "../components/pagar-cuota-dialog";
import { PrestamoDialog } from "../components/prestamo-dialog";
import { PrestamosKpis } from "../components/prestamos-kpis";
import { PrestamosSkeleton } from "../components/prestamos-skeleton";
import { VencimientosTable } from "../components/vencimientos-table";
import { useConciliacion } from "../queries/use-conciliacion";
import { useExportarPlantilla, useExportarReporte } from "../queries/use-prestamos-excel";
import { usePrestamos, useVencimientos } from "../queries/use-prestamos";
import type { Moneda, VencimientoDto } from "../types";

type Pestania = "vencimientos" | "operaciones" | "conciliacion";

/**
 * Préstamos y créditos bancarios. Reemplaza el Excel de Administración (`Prestamos La Clementina`),
 * donde la hoja maestra y las tablas dinámicas se cargaban por separado y quedaban desfasadas.
 *
 * Pesos y dólares son dos calendarios separados, sin conversión: es como trabaja el cliente y
 * meter un tipo de cambio agregaría una decisión que nadie pidió.
 */
export function PrestamosPage() {
  const { user } = useAuth();
  const puedeGestionar = user?.roles.includes("prestamos") ?? false;

  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [pestania, setPestania] = useState<Pestania>("vencimientos");
  const [incluirPagadas, setIncluirPagadas] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [pagando, setPagando] = useState<VencimientoDto | null>(null);
  const [importando, setImportando] = useState(false);

  const exportarPlantilla = useExportarPlantilla();
  const exportarReporte = useExportarReporte();
  // Sólo se consulta al abrir la pestaña: va por VPN contra la base del cliente.
  const conciliacion = useConciliacion(pestania === "conciliacion");

  const vencimientos = useVencimientos({ moneda, incluirPagadas });
  const operaciones = usePrestamos({ moneda });

  const error = vencimientos.error ?? operaciones.error;
  // Se chequean los datos y no `isPending`: con `keepPreviousData` los datos viejos siguen ahí
  // mientras se recarga, y así TypeScript también los estrecha a no-undefined.
  const datos =
    vencimientos.data && operaciones.data
      ? { vencimientos: vencimientos.data, operaciones: operaciones.data }
      : null;

  return (
    <>
      <PageHeader
        title="Préstamos Bancarios"
        subtitle="Qué se debe, a qué banco y cuándo vence cada cuota."
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportarReporte.mutate()}
              disabled={exportarReporte.isPending}
            >
              <Printer className="size-4" />
              {exportarReporte.isPending ? "Generando…" : "Reporte"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportarPlantilla.mutate({ moneda })}
              disabled={exportarPlantilla.isPending}
            >
              <Download className="size-4" />
              {exportarPlantilla.isPending ? "Generando…" : "Exportar plantilla"}
            </Button>
            {puedeGestionar && (
              <>
                <Button variant="outline" size="sm" onClick={() => setImportando(true)}>
                  <FileUp className="size-4" /> Importar
                </Button>
                <Button variant="accent" size="sm" onClick={() => setEditando(0)}>
                  <Plus className="size-4" /> Nuevo préstamo
                </Button>
              </>
            )}
          </div>
        }
      />

      {env.useMocks && (
        <p className="no-print mb-3 inline-block rounded-md border border-line bg-panel-soft px-3 py-1 text-xs font-medium text-clementina-deep">
          Datos de ejemplo (ficticios).
        </p>
      )}

      <FilterBar>
        <FilterField label="Moneda">
          <Select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
            <option value="USD">Dólares (U$S)</option>
            <option value="ARS">Pesos ($)</option>
          </Select>
        </FilterField>
        <FilterField label="Cuotas">
          <Select
            value={incluirPagadas ? "todas" : "pendientes"}
            onChange={(e) => setIncluirPagadas(e.target.value === "todas")}
          >
            <option value="pendientes">Sólo pendientes</option>
            <option value="todas">Todas (con las pagadas)</option>
          </Select>
        </FilterField>
      </FilterBar>

      {error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void vencimientos.refetch();
            void operaciones.refetch();
          }}
        />
      ) : !datos ? (
        <PrestamosSkeleton />
      ) : (
        <div className="space-y-4">
          <PrestamosKpis
            moneda={moneda}
            vencimientos={datos.vencimientos}
            operaciones={datos.operaciones}
          />

          <Tabs value={pestania} onValueChange={setPestania} className="space-y-3">
            <TabsList>
              <TabsTrigger value="vencimientos">
                Vencimientos ({datos.vencimientos.items.length})
              </TabsTrigger>
              <TabsTrigger value="operaciones">
                Operaciones ({datos.operaciones.length})
              </TabsTrigger>
              <TabsTrigger value="conciliacion">MacroGest</TabsTrigger>
            </TabsList>

            <TabsContent value="vencimientos">
              <VencimientosTable
                datos={datos.vencimientos}
                puedeGestionar={puedeGestionar}
                onPagar={(cuotaId) =>
                  setPagando(datos.vencimientos.items.find((v) => v.cuotaId === cuotaId) ?? null)
                }
              />
            </TabsContent>

            <TabsContent value="operaciones">
              <OperacionesTable
                filas={datos.operaciones}
                puedeGestionar={puedeGestionar}
                onEditar={setEditando}
                onVer={setEditando}
              />
            </TabsContent>

            <TabsContent value="conciliacion">
              <ConciliacionPanel
                datos={conciliacion.data}
                cargando={conciliacion.isPending || conciliacion.isFetching}
                error={conciliacion.error}
                onReintentar={() => void conciliacion.refetch()}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      <PrestamoDialog
        prestamoId={editando}
        onClose={() => setEditando(null)}
        monedaPorDefecto={moneda}
      />
      <PagarCuotaDialog cuota={pagando} onClose={() => setPagando(null)} />
      <ImportarDialog open={importando} onClose={() => setImportando(false)} />
    </>
  );
}
