import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/shared/components/data-table";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { FilterBar, FilterField } from "@/shared/components/filter-bar";
import { Pagination } from "@/shared/components/pagination";
import { toAppError } from "@/lib/api-error";
import type { VendedorComercial } from "../types";
import { useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import { useCambiarActivoVendedor } from "../queries/use-vendedores";

/** Cuántos vendedores entran por página sin que el diálogo pida scroll propio. */
const PAGE_SIZE = 10;

const colador = new Intl.Collator("es-AR", { numeric: true, sensitivity: "base" });

type Estado = "todos" | "activos" | "inactivos";

/**
 * Elección de qué vendedores de MacroGest aparecen en Plan de siembra y Consolidado.
 *
 * <p>Vive en un diálogo y no en una solapa: es configuración que se toca cada tanto (el padrón
 * de viajantes se mueve un par de veces por campaña), y ocupaba una de las cuatro pestañas que
 * se miran todos los días.</p>
 *
 * <p>El listado son los viajantes de MacroGest con al menos un cliente activo, así que crece con
 * el padrón: por eso pagina y filtra por estado en vez de mostrarse entero. El tilde guarda solo,
 * sin botón de confirmar, así que el diálogo nunca tiene borrador que avisar al cerrarse.</p>
 */
export function VendedoresDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vendedores = useVendedoresPlanificacion(open);
  const cambiarActivo = useCambiarActivoVendedor();
  const [estado, setEstado] = useState<Estado>("todos");
  const [page, setPage] = useState(1);

  async function alternar(vendedor: VendedorComercial) {
    try {
      await cambiarActivo.mutateAsync({ id: vendedor.id, activo: !vendedor.activo });
    } catch (error) {
      toast.error(toAppError(error).message);
    }
  }

  const columnas: Column<VendedorComercial>[] = [
    // Sin `sortBy` en ninguna columna: el orden lo resuelve el componente antes de cortar la
    // página, y el de DataTable sólo reordenaría las 10 filas visibles.
    {
      key: "nombre",
      header: "Vendedor MacroGest",
      cell: (vendedor) => <span className="font-semibold text-ink">{vendedor.nombre}</span>,
    },
    { key: "codigos", header: "Códigos", cell: (vendedor) => vendedor.viajantes.join(", ") },
    {
      key: "visible",
      header: "Mostrar en el plan",
      align: "center",
      cell: (vendedor) => (
        <input
          type="checkbox"
          className="size-4 accent-primary"
          aria-label={"Mostrar " + vendedor.nombre}
          checked={vendedor.activo}
          disabled={cambiarActivo.isPending}
          onChange={() => void alternar(vendedor)}
        />
      ),
    },
  ];

  const todos = vendedores.data ?? [];
  const activos = todos.filter((vendedor) => vendedor.activo).length;
  // Alfabético siempre: es un buscador de nombres, y con el listado partido en páginas el orden
  // tiene que ser el mismo dato a dato, no el que quedó en la página que se está mirando.
  const filtrados = todos
    .filter((vendedor) => estado === "todos" || vendedor.activo === (estado === "activos"))
    .toSorted((a, b) => colador.compare(a.nombre, b.nombre));
  // La página se recorta contra el total: destildar al último inactivo deja la página vacía.
  const totalPages = Math.max(Math.ceil(filtrados.length / PAGE_SIZE), 1);
  const pageSafe = Math.min(page, totalPages);
  const visibles = filtrados.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  return (
    <Modal open={open} onClose={onClose} title="Vendedores">
      <p className="mb-4 text-sm text-ink-soft">
        Elegí qué vendedores de MacroGest aparecen en Plan de siembra y Consolidado.
      </p>

      <FilterBar>
        <FilterField label="Estado">
          <Select
            value={estado}
            aria-label="Estado"
            onChange={(evento) => {
              setEstado(evento.target.value as Estado);
              setPage(1);
            }}
          >
            <option value="todos">Todos ({todos.length})</option>
            <option value="activos">Activos ({activos})</option>
            <option value="inactivos">Inactivos ({todos.length - activos})</option>
          </Select>
        </FilterField>
      </FilterBar>

      {vendedores.isError ? (
        <ErrorState error={vendedores.error} onRetry={() => void vendedores.refetch()} />
      ) : !vendedores.data ? (
        <EmptyState mensaje="Cargando vendedores de MacroGest…" />
      ) : (
        <>
          <DataTable
            columns={columnas}
            rows={visibles}
            getRowKey={(vendedor) => vendedor.id}
            empty={estado === "activos" ? "Ningún vendedor en el plan." : "Sin vendedores."}
          />
          {filtrados.length > PAGE_SIZE && (
            <Pagination
              page={pageSafe}
              totalPages={totalPages}
              total={filtrados.length}
              onPage={setPage}
              unidad={{ singular: "vendedor", plural: "vendedores" }}
            />
          )}
        </>
      )}
    </Modal>
  );
}
