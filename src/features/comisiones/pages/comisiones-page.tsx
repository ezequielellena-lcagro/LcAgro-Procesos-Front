import { useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { toAppError } from "@/lib/api-error";
import { env } from "@/lib/env";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { Pagination } from "@/shared/components/pagination";
import { ComisionesResumen } from "../components/comisiones-resumen";
import { ComisionesSkeleton } from "../components/comisiones-skeleton";
import { ComisionesTable } from "../components/comisiones-table";
import { CostoDialog } from "../components/costo-dialog";
import { useComisiones } from "../queries/use-comisiones";
import { useExportarComisiones } from "../queries/use-exportar-comisiones";
import { useGenerarComision } from "../queries/use-generar-comision";
import { useResumenComisiones } from "../queries/use-resumen-comisiones";
import type { ComisionDetalleDto } from "../types";

const PAGE_SIZE = 50;

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const HOY = new Date();

export function ComisionesPage() {
  const { hasAnyRole } = useAuth();
  const puedeGestionar = hasAnyRole(["comisiones"]);

  const [anio, setAnio] = useState(String(HOY.getFullYear()));
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [vendNro, setVendNro] = useState<number | "">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  // Mensaje de conflicto (409) del último intento de "Generar": mientras esté seteado, se ofrece
  // "Regenerar" (reintenta con forzar:true). Se limpia al cambiar de período o al tener éxito.
  const [conflicto, setConflicto] = useState<string | null>(null);
  // Renglón cuyo costo se está corrigiendo (la fila entera, no un id): null = diálogo cerrado.
  const [corregirCosto, setCorregirCosto] = useState<ComisionDetalleDto | null>(null);

  const anioNum = Number(anio) || HOY.getFullYear();

  // Resumen del mes SIEMPRE sin filtrar por vendedor: alimenta el panel y las opciones del Select.
  const resumen = useResumenComisiones({ anio: anioNum, mes, vendNro: undefined });

  const comisiones = useComisiones({
    anio: anioNum,
    mes,
    vendNro: vendNro === "" ? undefined : vendNro,
    q: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const generar = useGenerarComision();
  const exportar = useExportarComisiones();

  const cambiarPeriodo = (nuevoAnio: string, nuevoMes: number) => {
    setAnio(nuevoAnio);
    setMes(nuevoMes);
    setPage(1);
    setConflicto(null);
    setCorregirCosto(null);
  };

  const handleGenerar = (forzar: boolean) => {
    generar.mutate(
      { anio: anioNum, mes, forzar },
      {
        onSuccess: () => setConflicto(null),
        onError: (err) => {
          const e = toAppError(err);
          if (e.status === 409) setConflicto(e.message);
        },
      },
    );
  };

  const exportarExcel = () => {
    exportar.mutate({
      anio: anioNum,
      mes,
      vendNro: vendNro === "" ? undefined : vendNro,
      q: q || undefined,
    });
  };

  const isError = comisiones.isError || resumen.isError;
  const isPending = comisiones.isPending || resumen.isPending || !comisiones.data || !resumen.data;
  const reintentar = () => {
    void comisiones.refetch();
    void resumen.refetch();
  };

  return (
    <>
      <PageHeader
        title="Liquidación de Comisiones"
        subtitle="Comisiones de vendedores sobre ventas de insumos, en vivo desde MacroGest."
        actions={
          puedeGestionar ? (
            <>
              <Button
                type="button"
                variant="accent"
                size="sm"
                disabled={generar.isPending}
                onClick={() => handleGenerar(false)}
              >
                {generar.isPending ? "Generando…" : "Generar (congelar %)"}
              </Button>
              {conflicto && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={generar.isPending}
                  onClick={() => handleGenerar(true)}
                >
                  Regenerar
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exportar.isPending}
                onClick={exportarExcel}
              >
                <Download className="size-4" /> {exportar.isPending ? "Exportando…" : "Exportar Excel"}
              </Button>
            </>
          ) : undefined
        }
      />

      {conflicto && (
        <p className="no-print mb-3 flex items-center gap-2 rounded-md border border-rojo/30 bg-rojo-bg px-3 py-2 text-xs font-medium text-rojo">
          <AlertTriangle className="size-4 shrink-0" /> {conflicto}
        </p>
      )}

      {env.useMocks && (
        <p className="no-print mb-3 inline-block rounded-md border border-line bg-panel-soft px-3 py-1 text-xs font-medium text-clementina-deep">
          Datos de ejemplo (ficticios).
        </p>
      )}

      <FilterBar>
        <FilterField label="Mes">
          <Select value={mes} onChange={(e) => cambiarPeriodo(anio, Number(e.target.value))}>
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Año">
          <Input
            type="number"
            inputMode="numeric"
            className="w-24"
            value={anio}
            onChange={(e) => cambiarPeriodo(e.target.value, mes)}
          />
        </FilterField>
        <FilterField label="Vendedor">
          <Select
            value={vendNro}
            onChange={(e) => {
              setVendNro(e.target.value === "" ? "" : Number(e.target.value));
              setPage(1);
            }}
            disabled={resumen.isPending}
          >
            <option value="">Todos los vendedores</option>
            {resumen.data?.vendedores.map((v) => (
              <option key={v.vendedorNro} value={v.vendedorNro}>
                {v.vendedor}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Buscar cliente / producto / comprobante">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Denominación, producto o comprobante"
          />
        </FilterField>
      </FilterBar>

      {isError ? (
        <ErrorState error={comisiones.error ?? resumen.error} onRetry={reintentar} />
      ) : isPending ? (
        <ComisionesSkeleton />
      ) : (
        <div className="space-y-4">
          <ComisionesResumen
            resumen={resumen.data}
            vendedorSeleccionado={vendNro}
            onSeleccionarVendedor={(nro) => {
              setVendNro((prev) => (prev === nro ? "" : nro));
              setPage(1);
            }}
          />
          {comisiones.data.items.length === 0 ? (
            <EmptyState mensaje="No hay comisiones con esos filtros." />
          ) : (
            <>
              <ComisionesTable
                filas={comisiones.data.items}
                puedeCorregirCosto={puedeGestionar}
                onCorregirCosto={setCorregirCosto}
              />
              <Pagination
                page={comisiones.data.page}
                totalPages={comisiones.data.totalPages}
                total={comisiones.data.total}
                onPage={setPage}
              />
            </>
          )}
        </div>
      )}

      {/* Montado siempre (fuera de isPending/isError): el Modal devuelve null si `fila` es null. */}
      <CostoDialog fila={corregirCosto} onClose={() => setCorregirCosto(null)} />
    </>
  );
}
