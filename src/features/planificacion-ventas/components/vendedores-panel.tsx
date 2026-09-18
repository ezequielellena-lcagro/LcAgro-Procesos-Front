import { useEffect } from "react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/shared/components/data-table";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { toAppError } from "@/lib/api-error";
import type { ContextoPlanificacion, VendedorComercial } from "../types";
import { useVendedoresPlanificacion } from "../queries/use-plan-siembra";
import { useCambiarActivoVendedor } from "../queries/use-vendedores";

export function VendedoresPanel({
  contexto, activo, onDirtyChange,
}: {
  contexto: ContextoPlanificacion;
  activo: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const habilitado = activo && contexto.alcance.veTodo;
  const vendedores = useVendedoresPlanificacion(habilitado);
  const cambiarActivo = useCambiarActivoVendedor();
  useEffect(() => onDirtyChange(false), [onDirtyChange]);

  async function alternar(vendedor: VendedorComercial) {
    try {
      await cambiarActivo.mutateAsync({ id: vendedor.id, activo: !vendedor.activo });
    } catch (error) {
      toast.error(toAppError(error).message);
    }
  }

  const columnas: Column<VendedorComercial>[] = [
    { key: "nombre", header: "Vendedor MacroGest", sortBy: (vendedor) => vendedor.nombre,
      cell: (vendedor) => <span className="font-semibold text-ink">{vendedor.nombre}</span> },
    { key: "codigos", header: "Códigos", cell: (vendedor) => vendedor.viajantes.join(", ") },
    { key: "visible", header: "Mostrar en el plan", align: "center",
      cell: (vendedor) => <input type="checkbox" className="size-4 accent-primary"
        aria-label={"Mostrar " + vendedor.nombre} checked={vendedor.activo}
        disabled={cambiarActivo.isPending}
        onChange={() => void alternar(vendedor)} /> },
  ];

  if (!contexto.alcance.veTodo) return null;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Vendedores</h2>
        <p className="text-sm text-ink-soft">
          Elegí qué vendedores de MacroGest aparecen en Plan de siembra y Consolidado.
        </p>
      </div>
      {vendedores.isError ? (
        <ErrorState error={vendedores.error} onRetry={() => void vendedores.refetch()} />
      ) : !vendedores.data ? (
        <EmptyState mensaje="Cargando vendedores de MacroGest…" />
      ) : (
        <DataTable columns={columnas} rows={vendedores.data} getRowKey={(vendedor) => vendedor.id}
          defaultSort={{ key: "nombre" }} empty="Sin vendedores." />
      )}
    </section>
  );
}
