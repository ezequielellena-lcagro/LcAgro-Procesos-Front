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
import { PagosPanel } from "../components/pagos-panel";
import { PrestamoDialog } from "../components/prestamo-dialog";
import { PrestamosKpis } from "../components/prestamos-kpis";
import { PrestamosSkeleton } from "../components/prestamos-skeleton";
import { ResumenMatriz } from "../components/resumen-matriz";
import {
  VencimientosTable,
  type AgrupacionVencimientos,
} from "../components/vencimientos-table";
import { useConciliacion, useDescartar, useQuitarDescarte } from "../queries/use-conciliacion";
import { useConfirmarPagos, usePagosMacroGest } from "../queries/use-pagos-macrogest";
import { useResumen } from "../queries/use-resumen";
import { useExportarPlantilla, useExportarReporte } from "../queries/use-prestamos-excel";
import { usePrestamos, useVencimientos } from "../queries/use-prestamos";
import type { Agrupacion, Moneda, VencimientoDto } from "../types";

type Pestania = "vencimientos" | "operaciones" | "resumen" | "conciliacion" | "pagos";

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
  const [agrupacion, setAgrupacion] = useState<Agrupacion>("mes");
  const [agrupaVto, setAgrupaVto] = useState<AgrupacionVencimientos>("ninguna");

  const exportarPlantilla = useExportarPlantilla();
  const exportarReporte = useExportarReporte();
  // Sólo se consulta al abrir la pestaña: va por VPN contra la base del cliente.
  const conciliacion = useConciliacion(pestania === "conciliacion");
  const descartar = useDescartar();
  const quitarDescarte = useQuitarDescarte();
  const resumen = useResumen({ moneda, incluirPagadas, agrupacion }, pestania === "resumen");
  const pagos = usePagosMacroGest(pestania === "pagos");
  const confirmarPagos = useConfirmarPagos();

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
        {/* Sólo aplica al calendario; en las otras pestañas confundiría más de lo que ayuda. */}
        {pestania === "vencimientos" ? (
          <FilterField
            label="Agrupar"
            title="Junta las cuotas de un mismo préstamo, que en el calendario quedan intercaladas."
          >
            <Select
              value={agrupaVto}
              onChange={(e) => setAgrupaVto(e.target.value as AgrupacionVencimientos)}
            >
              <option value="ninguna">Sin agrupar (calendario)</option>
              <option value="operacion">Por operación</option>
              <option value="banco">Por banco</option>
            </Select>
          </FilterField>
        ) : null}
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
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="conciliacion">MacroGest</TabsTrigger>
              <TabsTrigger value="pagos">Pagos del banco</TabsTrigger>
            </TabsList>

            <TabsContent value="vencimientos">
              <VencimientosTable
                datos={datos.vencimientos}
                agrupacion={agrupaVto}
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

            <TabsContent value="resumen">
              <ResumenMatriz
                datos={resumen.data}
                agrupacion={agrupacion}
                onAgrupacionChange={setAgrupacion}
                cargando={resumen.isPending}
              />
            </TabsContent>

            <TabsContent value="pagos">
              <PagosPanel
                datos={pagos.data}
                cargando={pagos.isPending || pagos.isFetching}
                error={pagos.error}
                onReintentar={() => void pagos.refetch()}
                onConfirmar={(items) => confirmarPagos.mutate(items)}
                confirmando={confirmarPagos.isPending}
                puedeGestionar={puedeGestionar}
              />
            </TabsContent>

            <TabsContent value="conciliacion">
              <ConciliacionPanel
                datos={conciliacion.data}
                cargando={conciliacion.isPending || conciliacion.isFetching}
                error={conciliacion.error}
                onReintentar={() => void conciliacion.refetch()}
                onDescartar={(input) => descartar.mutate(input)}
                onQuitarDescarte={(id) => quitarDescarte.mutate(id)}
                puedeGestionar={puedeGestionar}
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
