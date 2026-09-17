import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { PageHeader } from "@/shared/components/page-header";
import { PlanSiembraPanel } from "../components/plan-siembra-panel";
import { useContextoPlanificacion } from "../queries/use-plan-siembra";

export function PlanificacionVentasPage() {
  const contexto = useContextoPlanificacion();
  return (
    <div>
      <PageHeader
        title="Planificación de Ventas"
        subtitle="Plan de siembra y seguimiento comercial por campaña."
      />
      <div className="mb-5 flex gap-3 border-b border-line pb-2">
        <span className="rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Plan de siembra
        </span>
        <span className="px-4 py-2 text-sm text-ink-soft">Consolidado</span>
        {contexto.data?.alcance.veTodo && (
          <>
            <span className="px-4 py-2 text-sm text-ink-soft">Market Share</span>
            <span className="px-4 py-2 text-sm text-ink-soft">Vendedores</span>
          </>
        )}
      </div>
      {contexto.isError ? (
        <ErrorState error={contexto.error} onRetry={() => void contexto.refetch()} />
      ) : contexto.data ? (
        <PlanSiembraPanel contexto={contexto.data} />
      ) : (
        <EmptyState mensaje="Cargando planificación de ventas…" />
      )}
    </div>
  );
}
