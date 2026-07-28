import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { env } from "@/lib/env";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { ExportButtons } from "@/shared/components/export-buttons";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { PageHeader } from "@/shared/components/page-header";
import { Pagination } from "@/shared/components/pagination";
import { fecha } from "@/shared/format/format";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { ProveedoresKpis } from "../components/proveedores-kpis";
import { ProveedoresSkeleton } from "../components/proveedores-skeleton";
import { ProveedoresTable } from "../components/proveedores-table";
import { useCatalogoProveedores } from "../queries/use-catalogo-proveedores";
import { useExportarProveedores } from "../queries/use-exportar-proveedores";
import { useProveedores } from "../queries/use-proveedores";

const PAGE_SIZE = 50;

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const HOY = new Date();

/**
 * El año es un combo y no un input libre a propósito: escribiendo, cada tecla deja un año a medio
 * tipear ("202", "20", "2") que es un estado válido para React pero inválido para el backend
 * (acepta 2020-2100) y dispara una consulta real por pulsación. Con un combo no existe el estado
 * intermedio. Rango: el año en curso ±2, que cubre revisar el cierre anterior y proyectar.
 */
const ANIOS = Array.from({ length: 5 }, (_, i) => HOY.getFullYear() - 2 + i);

/**
 * Proyección de deuda a proveedores (USD). El único parámetro temporal es el MES BASE: de ahí el
 * backend deriva la fecha base y los horizontes, así "a 6 meses" siempre es a 6 meses desde donde
 * estás parado. La pantalla es 100 % informativa: no edita nada.
 */
export function ProveedoresPage() {
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [proveedor, setProveedor] = useState<number | "">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  /**
   * El texto se debouncea antes de entrar al `queryKey`: sin esto cada tecla dispara una agregación
   * completa sobre `moviprov1` (~34.500 movimientos de la zona) contra la base de producción, y
   * encima el backend filtra el texto en memoria, así que la consulta no se acota. El input sigue
   * mostrando lo que se tipea; lo que se retrasa es la consulta.
   */
  const qBuscado = useDebounce(q, 300);

  const catalogo = useCatalogoProveedores();
  const proveedores = useProveedores({
    anio,
    mes,
    proveedor: proveedor === "" ? undefined : proveedor,
    q: qBuscado || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const exportar = useExportarProveedores();

  // Todo cambio de filtro vuelve a la página 1: si no, se queda en una página que ya no existe.
  const cambiarMesBase = (nuevoAnio: number, nuevoMes: number) => {
    setAnio(nuevoAnio);
    setMes(nuevoMes);
    setPage(1);
  };

  const exportarExcel = () => {
    exportar.mutate({
      anio,
      mes,
      proveedor: proveedor === "" ? undefined : proveedor,
      // El mismo texto debounceado que alimenta la tabla: el archivo tiene que ser exactamente lo
      // que se está viendo. Con el `q` sin debouncear, exportar dentro de los 300 ms de tipear daría
      // un Excel filtrado distinto de la pantalla.
      q: qBuscado || undefined,
    });
  };

  return (
    <>
      <PageHeader
        title="Cuentas Corrientes Proveedores USD"
        subtitle="Cuántos dólares hay que desembolsar en cada ventana de vencimiento (USD)."
        actions={<ExportButtons onExcel={exportarExcel} excelLoading={exportar.isPending} />}
      />

      {env.useMocks && (
        <p className="no-print mb-3 inline-block rounded-md border border-line bg-panel-soft px-3 py-1 text-xs font-medium text-clementina-deep">
          Datos de ejemplo (ficticios).
        </p>
      )}

      <FilterBar>
        <FilterField label="Mes base">
          <Select value={mes} onChange={(e) => cambiarMesBase(anio, Number(e.target.value))}>
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Año">
          <Select value={anio} onChange={(e) => cambiarMesBase(Number(e.target.value), mes)}>
            {ANIOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Proveedor">
          <Select
            value={proveedor}
            onChange={(e) => {
              setProveedor(e.target.value === "" ? "" : Number(e.target.value));
              setPage(1);
            }}
            disabled={catalogo.isPending}
          >
            <option value="">Todos los proveedores</option>
            {catalogo.data?.map((p) => (
              <option key={p.numero} value={p.numero}>
                {p.denominacion}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Buscar proveedor / N°">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Razón social o N° de proveedor"
          />
        </FilterField>
      </FilterBar>

      {proveedores.isError ? (
        <ErrorState error={proveedores.error} onRetry={() => void proveedores.refetch()} />
      ) : proveedores.isPending ? (
        <ProveedoresSkeleton />
      ) : (
        <div className="space-y-4">
          {/* Los datos se mueven entre corridas (se cargan facturas y pagos): dejamos explícito a
              qué fecha base está armado el calendario y cuándo se consultó. */}
          <p className="text-xs text-ink-soft">
            Fecha base {fecha(proveedores.data.fechaBase)} · consultado{" "}
            {new Date(proveedores.dataUpdatedAt).toLocaleString("es-AR")}
          </p>

          <ProveedoresKpis
            tramos={proveedores.data.tramos}
            totales={proveedores.data.totales}
            fechaBase={proveedores.data.fechaBase}
          />

          {proveedores.data.items.length === 0 ? (
            <EmptyState mensaje="No hay proveedores con esos filtros." />
          ) : (
            <>
              <ProveedoresTable
                filas={proveedores.data.items}
                tramos={proveedores.data.tramos}
                totales={proveedores.data.totales}
              />
              <Pagination
                page={proveedores.data.page}
                totalPages={proveedores.data.totalPages}
                total={proveedores.data.total}
                onPage={setPage}
                unidad={{ singular: "proveedor", plural: "proveedores" }}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}
